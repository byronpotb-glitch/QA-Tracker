# User Roles (Admin / Viewer) — Design

**Date:** 2026-08-01
**Status:** Implemented

## Problem

Every logged-in Supabase account today has full write access to everything —
there is no concept of a role. The owner wants to hand out read-only access
to other people without giving them the ability to create, edit, delete, or
import tickets and test cases.

## Goal

Two roles: `admin` (full access, as today) and `viewer` (read-only
everywhere). Admins can create new accounts and assign roles from inside the
app, instead of using the Supabase dashboard.

## Data model

New `profiles` table, alongside the existing `tickets` / `test_cases` tables
in `src/db/schema.ts`:

```ts
export const roleEnum = pgEnum("role", ["admin", "viewer"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // matches auth.users.id
  email: text("email").notNull(),
  role: roleEnum("role").notNull().default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- `id` is not declared as a Drizzle FK (Drizzle doesn't model the `auth`
  schema), but the migration adds a raw SQL foreign key to `auth.users(id)
  on delete cascade` so deleting a Supabase auth user cleans up its profile.
- Default role is `viewer` — a missing or not-yet-created profile row means
  read-only, not accidental admin access.
- The migration seeds one row for the existing `byronpotb@gmail.com` account
  as `admin`, found via `auth.users` (same Postgres database, no manual ID
  lookup needed). Any other pre-existing account (e.g.
  `ui-preview-temp@example.com`) is left with no row and is therefore
  `viewer` by default.

## Role resolution

`src/lib/auth/roles.ts`:

- `getCurrentUser()` — reads the Supabase session, joins to `profiles` by id,
  returns `{ id, email, role }` (role defaults to `"viewer"` if no profile
  row exists).
- `requireAdmin()` — calls `getCurrentUser()`, returns
  `{ error: "You don't have permission to do this." }` if role isn't
  `"admin"`. Every write action calls this first, before touching the
  database.

## Enforcement points

Server actions (the real security boundary — UI hiding is defense-in-depth
only, not sufficient on its own):

- `tickets/actions.ts`: `createTicket`, `addTestCase`, `updateTestCase`,
  `updateTestCaseStatus`, `deleteTestCase`, `toggleManualOverride`,
  `setTicketStatus`, `setTicketDev`, `setTicketCreatedAt`, `retestTicket`
- `import/actions.ts`: `previewExcelImport`, `applyExcelImport`,
  `cleanupExcelImport` — only `applyExcelImport` actually writes to the
  database; `previewExcelImport` and `cleanupExcelImport` are read-only
  (the latter returns a cleaned `.xlsx` for download, never touches `db`).
  All three are gated anyway since the whole Import feature is admin-only.
- new `users/actions.ts`: `createUserAccount`, `updateUserRole`

Page-level guards (redirect non-admins away entirely, not just hide buttons):

- `/import` — redirects to `/dashboard` for viewers
- `/tickets/new` — redirects to `/dashboard` for viewers
- `/users` — redirects to `/dashboard` for viewers

## Users page (admin-only)

New sidebar item "Users", rendered only when `getCurrentUser().role ===
"admin"`.

`/users` page:

- Table of all `profiles` rows: email, role, created date.
- Inline role dropdown per row → `updateUserRole(userId, role)`. Blocked
  server-side if it would demote the last remaining admin (returns an error
  instead of applying the change).
- "Create user" form: email, temporary password, role select. Submits to
  `createUserAccount`, which:
  1. `requireAdmin()`
  2. Creates the Supabase auth user via the **service role key**
     (`supabase.auth.admin.createUser({ email, password, email_confirm:
     true })`) — a new `src/lib/supabase/admin.ts` wraps this client. The
     service role key is never sent to the browser; this only runs in the
     server action.
  3. Inserts the matching `profiles` row.
  4. Surfaces Supabase errors (duplicate email, weak password) as
     `{ error }`.

No delete/deactivate in this pass — create, list, and role-change only.

## UI-level hiding (defense in depth)

- Sidebar hides "Import" and "Users" for viewers.
- Ticket list / detail / test-case pages hide New Ticket, Add/Edit/Delete
  test case, Retest, and manual-override controls for viewers.

## Testing

- Unit tests for `requireAdmin()` / `getCurrentUser()` default-viewer
  behavior and the last-admin-demotion guard.
- Server action tests confirming a viewer role is rejected by each write
  action listed above.
