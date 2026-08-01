# User Roles (Admin / Viewer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two roles (`admin`, `viewer`) to qa-tracker. Admins keep full access; viewers can read everything but every write is rejected server-side. Admins can create new accounts and change roles from a new in-app "Users" page.

**Architecture:** A new `profiles` table (id/email/role, default `viewer`) sits alongside the existing Drizzle schema. A `getCurrentUser()`/`requireAdmin()` helper in `src/lib/auth/roles.ts` is the single source of truth for role checks, called at the top of every write server action (the real security boundary) and at the top of every admin-only page (redirect guard). A `RoleProvider` React context (fed by the dashboard layout, a Server Component) lets client components hide edit affordances for viewers without prop-drilling. A new `src/lib/supabase/admin.ts` wraps the Supabase service-role client, used only by the new Users feature to create accounts.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM (postgres-js), Supabase Auth (`@supabase/ssr` + `@supabase/supabase-js` for the admin client), Zod, Vitest, Tailwind, shadcn/ui components (`Button`, `Select`, `Table`, `Card`, `Input`, `Label`).

## Global Constraints

- Every write server action must call `requireAdmin()` first and return early with `{ error: "..." }` — never skip this, even for actions that seem low-risk.
- Default role for any account without a `profiles` row is `"viewer"` — deny-by-default, never default to `"admin"`.
- The Supabase **service role key** (`SUPABASE_SERVICE_ROLE_KEY`) must only be read inside server-only files under `src/lib/supabase/admin.ts` and the `users/actions.ts` server action — never imported into any Client Component or exposed to the browser.
- Follow existing patterns: `ActionResult` (`{ error: string | null }`) return shape, `revalidatePath` after writes, `useTransition` + `sonner` `toast` in client components, `useActionState` for form-based actions (see `login-form.tsx`).
- Pure logic (role defaulting, last-admin-demotion check) lives in plain functions with direct Vitest unit tests, separate from the DB/Supabase IO wrappers — matches the existing `computeRollupStatus`/`applyRollup` split in `src/lib/rollup.ts` vs `src/lib/recompute-rollup.ts`.

---

### Task 1: `profiles` table + migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/00XX_<auto>.sql` (name assigned by `drizzle-kit generate`, then hand-edited)

**Interfaces:**
- Produces: `roleEnum` (pgEnum: `"admin" | "viewer"`), `profiles` table (`id: uuid PK`, `email: text`, `role: roleEnum default 'viewer'`, `createdAt: timestamp`), types `Profile = typeof profiles.$inferSelect`, `NewProfile = typeof profiles.$inferInsert`.

- [ ] **Step 1: Add the enum and table to `src/db/schema.ts`**

Add near the top, alongside the other `pgEnum` declarations (after `testCaseStatusEnum`):

```ts
export const roleEnum = pgEnum("role", ["admin", "viewer"]);
```

Add near the bottom, after `testCaseHistoryRelations` and before the `export type` block:

```ts
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  role: roleEnum("role").notNull().default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Add to the existing `export type` block at the end of the file:

```ts
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`

Expected: a new file `src/db/migrations/00XX_<name>.sql` containing `CREATE TYPE "role" AS ENUM ('admin', 'viewer');` and `CREATE TABLE "profiles" (...)`, plus updated `src/db/migrations/meta/_journal.json` and a new snapshot json. Note the generated filename for the next step.

- [ ] **Step 3: Append the FK and seed insert to the generated migration file**

Open the newly generated `src/db/migrations/00XX_<name>.sql` and append to the end (after the last `--> statement-breakpoint`):

```sql
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_auth_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "profiles" ("id", "email", "role")
SELECT "id", "email", 'admin'
FROM "auth"."users"
WHERE "email" = 'byronpotb@gmail.com'
ON CONFLICT ("id") DO NOTHING;
```

- [ ] **Step 4: Apply the migration**

Run: `npm run db:migrate`

Expected: command exits 0. Verify with:

```bash
node -e "
require('dotenv').config({ path: '.env.local', quiet: true });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
sql\`select email, role from profiles\`.then(r => { console.log(r); return sql.end(); });
"
```

Expected output: one row, `byronpotb@gmail.com` / `admin`.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/migrations
git commit -m "Add profiles table with admin/viewer role"
```

---

### Task 2: Role resolution helpers

**Files:**
- Create: `src/lib/auth/roles.ts`
- Create: `src/lib/auth/role-guard.ts`
- Test: `src/lib/auth/__tests__/roles.test.ts`
- Test: `src/lib/auth/__tests__/role-guard.test.ts`

**Interfaces:**
- Consumes: `db` from `@/db`, `profiles` from `@/db/schema`, `createClient` from `@/lib/supabase/server`.
- Produces: `type Role = "admin" | "viewer"`, `resolveRole(profileRow: { role: Role } | undefined): Role`, `interface CurrentUser { id: string; email: string; role: Role }`, `getCurrentUser(): Promise<CurrentUser | null>`, `interface RoleCheckResult { error: string | null }`, `requireAdmin(): Promise<RoleCheckResult>`, `canChangeRole(allProfiles: { id: string; role: Role }[], targetId: string, nextRole: Role): boolean`.

- [ ] **Step 1: Write the failing tests for the pure functions**

Create `src/lib/auth/__tests__/roles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveRole } from "@/lib/auth/roles";

describe("resolveRole", () => {
  it("returns the profile's role when a row exists", () => {
    expect(resolveRole({ role: "admin" })).toBe("admin");
    expect(resolveRole({ role: "viewer" })).toBe("viewer");
  });

  it("defaults to viewer when there is no profile row", () => {
    expect(resolveRole(undefined)).toBe("viewer");
  });
});
```

Create `src/lib/auth/__tests__/role-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canChangeRole } from "@/lib/auth/role-guard";

describe("canChangeRole", () => {
  const admin = { id: "a1", role: "admin" as const };
  const viewer = { id: "v1", role: "viewer" as const };

  it("allows promoting a viewer to admin", () => {
    expect(canChangeRole([admin, viewer], "v1", "admin")).toBe(true);
  });

  it("allows demoting an admin when another admin remains", () => {
    const admin2 = { id: "a2", role: "admin" as const };
    expect(canChangeRole([admin, admin2, viewer], "a1", "viewer")).toBe(true);
  });

  it("blocks demoting the last remaining admin", () => {
    expect(canChangeRole([admin, viewer], "a1", "viewer")).toBe(false);
  });

  it("allows re-confirming the last admin's role as admin", () => {
    expect(canChangeRole([admin, viewer], "a1", "admin")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/auth`
Expected: FAIL — `@/lib/auth/roles` and `@/lib/auth/role-guard` don't exist yet.

- [ ] **Step 3: Implement `src/lib/auth/role-guard.ts`**

```ts
export type Role = "admin" | "viewer";

/**
 * Blocks demoting the last remaining admin — everything else is allowed.
 */
export function canChangeRole(
  allProfiles: { id: string; role: Role }[],
  targetId: string,
  nextRole: Role
): boolean {
  if (nextRole === "admin") return true;

  const target = allProfiles.find((p) => p.id === targetId);
  if (!target || target.role !== "admin") return true;

  const adminCount = allProfiles.filter((p) => p.role === "admin").length;
  return adminCount > 1;
}
```

- [ ] **Step 4: Implement `src/lib/auth/roles.ts`**

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/role-guard";

export type { Role };

export function resolveRole(profileRow: { role: Role } | undefined): Role {
  return profileRow?.role ?? "viewer";
}

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  });

  return {
    id: user.id,
    email: user.email ?? "",
    role: resolveRole(profile),
  };
}

export interface RoleCheckResult {
  error: string | null;
}

export async function requireAdmin(): Promise<RoleCheckResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { error: "You don't have permission to do this." };
  }
  return { error: null };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/auth`
Expected: PASS, 6 tests.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth
git commit -m "Add role resolution helpers (getCurrentUser, requireAdmin, canChangeRole)"
```

---

### Task 3: Gate `tickets/actions.ts` write actions

**Files:**
- Modify: `src/app/(dashboard)/tickets/actions.ts`
- Test: `src/app/(dashboard)/tickets/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` from `@/lib/auth/roles` (Task 2).
- Produces: no new exports — same function signatures as today, now rejecting non-admins.

This task adds one line — `const check = await requireAdmin(); if (check.error) return check;` (or `return redirect(...)` is NOT used here — these return `ActionResult`/`CreateTicketState`, both shaped `{ error: string | null }`, so returning `check` directly works) — as the first line of every write action's body.

- [ ] **Step 1: Write the failing tests**

These tests mock `@/lib/auth/roles` to simulate a viewer, and assert every write action short-circuits with an error instead of touching `db`. Create `src/app/(dashboard)/tickets/__tests__/actions.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth/roles", () => ({
  requireAdmin: () => requireAdminMock(),
}));

const dbMock = {
  insert: vi.fn(() => { throw new Error("db.insert should not be called for a viewer"); }),
  update: vi.fn(() => { throw new Error("db.update should not be called for a viewer"); }),
  delete: vi.fn(() => { throw new Error("db.delete should not be called for a viewer"); }),
  query: { tickets: { findFirst: vi.fn() } },
  transaction: vi.fn(() => { throw new Error("db.transaction should not be called for a viewer"); }),
};
vi.mock("@/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import {
  addTestCase,
  updateTestCase,
  updateTestCaseStatus,
  deleteTestCase,
  toggleManualOverride,
  setTicketStatus,
  setTicketDev,
  setTicketCreatedAt,
  retestTicket,
} from "../actions";

const VIEWER_ERROR = { error: "You don't have permission to do this." };

beforeEach(() => {
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue(VIEWER_ERROR);
});

describe("write actions reject viewers", () => {
  it("addTestCase", async () => {
    const fd = new FormData();
    expect(await addTestCase("t1", fd)).toEqual(VIEWER_ERROR);
  });

  it("updateTestCase", async () => {
    const fd = new FormData();
    expect(await updateTestCase("t1", "tc1", fd)).toEqual(VIEWER_ERROR);
  });

  it("updateTestCaseStatus", async () => {
    expect(await updateTestCaseStatus("t1", "tc1", "PASSED")).toEqual(VIEWER_ERROR);
  });

  it("deleteTestCase", async () => {
    expect(await deleteTestCase("t1", "tc1")).toEqual(VIEWER_ERROR);
  });

  it("toggleManualOverride", async () => {
    expect(await toggleManualOverride("t1", true)).toEqual(VIEWER_ERROR);
  });

  it("setTicketStatus", async () => {
    expect(await setTicketStatus("t1", "PASSED")).toEqual(VIEWER_ERROR);
  });

  it("setTicketDev", async () => {
    expect(await setTicketDev("t1", "alice")).toEqual(VIEWER_ERROR);
  });

  it("setTicketCreatedAt", async () => {
    expect(await setTicketCreatedAt("t1", "2026-01-01")).toEqual(VIEWER_ERROR);
  });

  it("retestTicket", async () => {
    expect(await retestTicket("t1")).toEqual(VIEWER_ERROR);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/\(dashboard\)/tickets/__tests__/actions.test.ts`
Expected: FAIL — actions currently call `db` directly without checking `requireAdmin`, so the mocked `db` throws instead of returning the viewer error.

- [ ] **Step 3: Add the guard to every write action**

In `src/app/(dashboard)/tickets/actions.ts`, add the import:

```ts
import { requireAdmin } from "@/lib/auth/roles";
```

Then add this as the first line inside each of these function bodies (`addTestCase`, `updateTestCase`, `updateTestCaseStatus`, `deleteTestCase`, `toggleManualOverride`, `setTicketStatus`, `setTicketDev`, `setTicketCreatedAt`, `retestTicket`):

```ts
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;
```

For `createTicket` (which returns `CreateTicketState`, redirects on success instead of returning `{error}` inline), add the same two lines as the first statement in the function body — the shape matches (`{ error: string | null }`), so `return roleCheck;` works unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/\(dashboard\)/tickets/__tests__/actions.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Run the full test suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all existing tests still pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/tickets/actions.ts" "src/app/(dashboard)/tickets/__tests__"
git commit -m "Gate ticket/test-case write actions behind requireAdmin"
```

---

### Task 4: Gate Import feature (actions + page)

**Files:**
- Modify: `src/app/(dashboard)/import/actions.ts`
- Rename: `src/app/(dashboard)/import/page.tsx` → `src/app/(dashboard)/import/import-client.tsx`
- Create: `src/app/(dashboard)/import/page.tsx` (new, Server Component wrapper)
- Test: `src/app/(dashboard)/import/__tests__/actions-auth.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `getCurrentUser` from `@/lib/auth/roles`.
- Produces: same `previewExcelImport`/`applyExcelImport`/`cleanupExcelImport` signatures, now admin-gated. `ImportPageClient` export from the renamed file.

- [ ] **Step 1: Write the failing test**

Create `src/app/(dashboard)/import/__tests__/actions-auth.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth/roles", () => ({
  requireAdmin: () => requireAdminMock(),
}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { previewExcelImport, applyExcelImport, cleanupExcelImport } from "../actions";

const VIEWER_ERROR = { error: "You don't have permission to do this." };

beforeEach(() => {
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue(VIEWER_ERROR);
});

describe("import actions reject viewers", () => {
  it("previewExcelImport", async () => {
    const result = await previewExcelImport(new FormData());
    expect(result.fileErrors).toEqual([VIEWER_ERROR.error]);
  });

  it("applyExcelImport", async () => {
    expect(await applyExcelImport(new FormData())).toEqual(VIEWER_ERROR);
  });

  it("cleanupExcelImport", async () => {
    const result = await cleanupExcelImport(new FormData());
    expect(result.fileErrors).toEqual([VIEWER_ERROR.error]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(dashboard)/import/__tests__/actions-auth.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Add the guard to the three exported actions**

In `src/app/(dashboard)/import/actions.ts`, add the import:

```ts
import { requireAdmin } from "@/lib/auth/roles";
```

At the top of `previewExcelImport`, before `const upload = await parseUpload(formData);`:

```ts
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return fileErrorReport(roleCheck.error);
```

At the top of `applyExcelImport`, before `const upload = await parseUpload(formData);`:

```ts
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;
```

At the top of `cleanupExcelImport`, before `const upload = readUploadedFile(formData);`:

```ts
  const roleCheck = await requireAdmin();
  if (roleCheck.error) {
    return {
      fileErrors: [roleCheck.error],
      sheetName: null,
      fixes: [],
      remainingIssues: [],
      removedRowNumbers: [],
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(dashboard)/import/__tests__/actions-auth.test.ts"`
Expected: PASS, 3 tests.

- [ ] **Step 5: Rename the client page and wrap it with a server-side guard**

```bash
git mv "src/app/(dashboard)/import/page.tsx" "src/app/(dashboard)/import/import-client.tsx"
```

In `import-client.tsx`, change the function name (keep the `"use client"` directive and everything else unchanged):

```ts
export default function ImportPageClient() {
```

→ becomes a named export instead of default:

```ts
export function ImportPageClient() {
```

(Remove `export default` from that line, keep `export function ImportPageClient() {`.)

Create the new `src/app/(dashboard)/import/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";
import { ImportPageClient } from "./import-client";

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  return <ImportPageClient />;
}
```

- [ ] **Step 6: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; `/import` still listed in the route table.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/import"
git commit -m "Gate Excel import actions and page behind admin role"
```

---

### Task 5: Gate `/tickets/new` page

**Files:**
- Modify: `src/app/(dashboard)/tickets/new/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser` from `@/lib/auth/roles`.

- [ ] **Step 1: Add the guard**

Replace the full contents of `src/app/(dashboard)/tickets/new/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/roles";
import { NewTicketForm } from "./new-ticket-form";

export default async function NewTicketPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>New Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <NewTicketForm />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/tickets/new/page.tsx"
git commit -m "Gate new-ticket page behind admin role"
```

---

### Task 6: Supabase admin client

**Files:**
- Create: `src/lib/supabase/admin.ts`

**Interfaces:**
- Produces: `createAdminClient(): SupabaseClient` — service-role client, server-only.

- [ ] **Step 1: Implement**

```ts
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS and can manage auth users directly.
 * Server-only: never import this from a Client Component.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/admin.ts
git commit -m "Add Supabase service-role admin client"
```

---

### Task 7: Users feature — server actions

**Files:**
- Create: `src/app/(dashboard)/users/actions.ts`
- Test: `src/app/(dashboard)/users/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (Task 2), `createAdminClient` (Task 6), `canChangeRole` (Task 2), `profiles` (Task 1).
- Produces: `interface ActionResult { error: string | null }`, `createUserAccount(_prevState: ActionResult, formData: FormData): Promise<ActionResult>`, `updateUserRole(userId: string, role: Role): Promise<ActionResult>`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth/roles", () => ({
  requireAdmin: () => requireAdminMock(),
}));
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => Promise.resolve([])) })),
    insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const createAdminClientMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

import { createUserAccount, updateUserRole } from "../actions";

const VIEWER_ERROR = { error: "You don't have permission to do this." };

beforeEach(() => {
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue(VIEWER_ERROR);
  createAdminClientMock.mockReset();
});

describe("users actions reject non-admins", () => {
  it("createUserAccount", async () => {
    const fd = new FormData();
    fd.set("email", "new@example.com");
    fd.set("password", "password123");
    fd.set("role", "viewer");
    expect(await createUserAccount({ error: null }, fd)).toEqual(VIEWER_ERROR);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("updateUserRole", async () => {
    expect(await updateUserRole("u1", "admin")).toEqual(VIEWER_ERROR);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "src/app/(dashboard)/users/__tests__/actions.test.ts"`
Expected: FAIL — file doesn't exist yet.

- [ ] **Step 3: Implement `src/app/(dashboard)/users/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireAdmin, type Role } from "@/lib/auth/roles";
import { canChangeRole } from "@/lib/auth/role-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionResult {
  error: string | null;
}

export async function createUserAccount(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role: Role = formData.get("role") === "admin" ? "admin" : "viewer";

  if (!email) return { error: "Email is required." };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    return { error: error?.message ?? "Failed to create user." };
  }

  await db.insert(profiles).values({ id: data.user.id, email, role });

  revalidatePath("/users");
  return { error: null };
}

export async function updateUserRole(
  userId: string,
  role: Role
): Promise<ActionResult> {
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

  const allProfiles = await db
    .select({ id: profiles.id, role: profiles.role })
    .from(profiles);

  if (!canChangeRole(allProfiles, userId, role)) {
    return { error: "Can't remove the last remaining admin." };
  }

  await db.update(profiles).set({ role }).where(eq(profiles.id, userId));

  revalidatePath("/users");
  return { error: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "src/app/(dashboard)/users/__tests__/actions.test.ts"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/users/actions.ts" "src/app/(dashboard)/users/__tests__"
git commit -m "Add createUserAccount/updateUserRole server actions"
```

---

### Task 8: Users page + UI

**Files:**
- Create: `src/app/(dashboard)/users/page.tsx`
- Create: `src/app/(dashboard)/users/create-user-form.tsx`
- Create: `src/app/(dashboard)/users/users-table.tsx`

**Interfaces:**
- Consumes: `getCurrentUser` (Task 2), `createUserAccount`/`updateUserRole` (Task 7), `Profile` type (Task 1).
- Produces: default page export at `/users`; `CreateUserForm`, `UsersTable` client components.

- [ ] **Step 1: Implement `create-user-form.tsx`**

```tsx
"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserAccount, type ActionResult } from "./actions";

const initialState: ActionResult = { error: null };

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAccount, initialState);
  const [role, setRole] = useState<"admin" | "viewer">("viewer");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="role" value={role} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Temporary password</Label>
          <Input id="password" name="password" type="text" minLength={8} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="role-select">Role</Label>
          <Select
            value={role}
            onValueChange={(value) => value && setRole(value as "admin" | "viewer")}
          >
            <SelectTrigger id="role-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Creating..." : "Create user"}
      </Button>
    </form>
  );
}
```

`Select` here (`@base-ui/react/select` under the hood, per `src/components/ui/select.tsx`) is a custom listbox, not a native `<select>` — it doesn't participate in native form submission via a `name` prop. The `role` value is tracked with `useState` and mirrored into a `<input type="hidden" name="role">` so `createUserAccount`'s `formData.get("role")` sees it. This matches how `TestCaseRow`/`TicketControls` already use `Select` with `onValueChange` + client state rather than native form fields.

- [ ] **Step 2: Implement `users-table.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserRole } from "./actions";
import type { Profile } from "@/db/schema";

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function UsersTable({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
}) {
  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UserRow({ user, isSelf }: { user: Profile; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleRoleChange(value: string | null) {
    if (!value || value === user.role) return;
    startTransition(async () => {
      const result = await updateUserRole(user.id, value as "admin" | "viewer");
      if (result.error) toast.error(result.error);
      else toast.success("Role updated");
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {user.email}
        {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
      </TableCell>
      <TableCell>
        <Select value={user.role} onValueChange={handleRoleChange} disabled={pending}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">Viewer</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {dateFormatter.format(user.createdAt)}
      </TableCell>
    </TableRow>
  );
}
```

- [ ] **Step 3: Implement `page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateUserForm } from "./create-user-form";
import { UsersTable } from "./users-table";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    redirect("/dashboard");
  }

  const rows = await db.select().from(profiles).orderBy(desc(profiles.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage who can sign in and what they can do.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Create user</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateUserForm />
        </CardContent>
      </Card>

      <UsersTable users={rows} currentUserId={currentUser.id} />
    </div>
  );
}
```

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; `/users` appears in the build's route table.

- [ ] **Step 5: Manual check in the browser**

Run: `npm run dev`, log in as the seeded admin, visit `/users`. Confirm: the existing account (`byronpotb@gmail.com`, admin) is listed; creating a new user with the form adds a row without a page reload; changing that new user's role to viewer and back works; attempting to demote yourself when you're the only admin shows the "last remaining admin" error toast (temporarily testable by trying to demote the seeded admin before any second admin exists).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/users/page.tsx" "src/app/(dashboard)/users/create-user-form.tsx" "src/app/(dashboard)/users/users-table.tsx"
git commit -m "Add admin-only Users page (create account, list, change role)"
```

---

### Task 9: RoleProvider context

**Files:**
- Create: `src/lib/auth/role-context.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

**Interfaces:**
- Produces: `RoleProvider({ role, children })` (Client Component), `useRole(): Role`.
- Consumes (in layout): `getCurrentUser` from `@/lib/auth/roles`.

- [ ] **Step 1: Implement the context**

```tsx
"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/auth/roles";

const RoleContext = createContext<Role>("viewer");

export function RoleProvider({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): Role {
  return useContext(RoleContext);
}
```

- [ ] **Step 2: Wire it into the dashboard layout**

Replace the full contents of `src/app/(dashboard)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";
import { RoleProvider } from "@/lib/auth/role-context";
import { AppSidebar } from "./app-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <RoleProvider role={user.role}>
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </RoleProvider>
  );
}
```

Note: the middleware (`src/lib/supabase/middleware.ts`) already redirects unauthenticated requests to `/login` before they reach this layout, so the `redirect("/login")` above is a defensive fallback, not the primary guard.

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/role-context.tsx "src/app/(dashboard)/layout.tsx"
git commit -m "Add RoleProvider context, fetch current user's role once in layout"
```

---

### Task 10: Sidebar — admin-only nav items

**Files:**
- Modify: `src/app/(dashboard)/app-sidebar.tsx`

**Interfaces:**
- Consumes: `useRole()` from `src/lib/auth/role-context.tsx` (Task 9).

- [ ] **Step 1: Update `NAV_ITEMS` and filter by role**

In `src/app/(dashboard)/app-sidebar.tsx`, change the icon import (avoid reusing `UsersIcon` for both "Dev Performance" and the new "Users" link — pick a distinct icon for Users):

```ts
import {
  LayoutDashboardIcon,
  TicketIcon,
  UploadIcon,
  UsersIcon,
  UserCogIcon,
  LogOutIcon,
  ChevronDownIcon,
} from "lucide-react";
import { useRole } from "@/lib/auth/role-context";
```

Add an `adminOnly?: boolean` field to the `NavItem` interface:

```ts
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { href: string; label: string }[];
  adminOnly?: boolean;
}
```

Update `NAV_ITEMS`:

```ts
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  {
    href: "/tickets",
    label: "Tickets",
    icon: TicketIcon,
    children: [{ href: "/tickets/test-cases", label: "Test Cases" }],
  },
  { href: "/import", label: "Import", icon: UploadIcon, adminOnly: true },
  { href: "/dev-performance", label: "Dev Performance", icon: UsersIcon },
  { href: "/users", label: "Users", icon: UserCogIcon, adminOnly: true },
];
```

Inside `AppSidebar()`, read the role and filter before rendering:

```ts
export function AppSidebar() {
  const pathname = usePathname();
  const role = useRole();
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(visibleItems.filter((item) => item.children).map((item) => [item.href, true]))
  );
```

Change the `NAV_ITEMS.map(...)` in the JSX to `visibleItems.map(...)`.

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Manual check**

Run `npm run dev`, log in as admin: confirm "Import" and "Users" both show. (Viewer check happens end-to-end once Task 11 provides a real viewer login.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/app-sidebar.tsx"
git commit -m "Hide Import/Users nav items from viewers"
```

---

### Task 11: Hide edit affordances for viewers

**Files:**
- Modify: `src/app/(dashboard)/tickets/[id]/ticket-controls.tsx`
- Modify: `src/app/(dashboard)/tickets/[id]/test-case-row.tsx`
- Modify: `src/app/(dashboard)/tickets/[id]/dev-field.tsx`
- Modify: `src/app/(dashboard)/tickets/[id]/created-date-field.tsx`
- Modify: `src/app/(dashboard)/tickets/created-date-cell.tsx`
- Modify: `src/app/(dashboard)/tickets/page.tsx`
- Modify: `src/app/(dashboard)/tickets/[id]/page.tsx`

**Interfaces:**
- Consumes: `useRole()` from Task 10 (client components); `getCurrentUser()` directly (the two Server Component pages).

This is UI polish only — every action these components call is already rejected server-side for viewers (Tasks 3–4). A viewer who bypasses this hidden UI still gets a clean `{error}` toast, not a crash.

- [ ] **Step 1: `ticket-controls.tsx`** — read role, hide Retest button and manual-override toggle, show status as a read-only badge

Add the import: `import { useRole } from "@/lib/auth/role-context";`

At the top of `TicketControls()`: `const role = useRole();`

Wrap the Retest `<Button>` block: `{role === "admin" && status === "FAILED" && ( ... )}`

Replace the manual-override `<Select>`/toggle block: keep the `<StatusBadge>` display for viewers unconditionally, and wrap the `<Select>` (manual-override case) and the toggle `<Button>` in `{role === "admin" && ( ... )}` — i.e. viewers always see the read-only `<StatusBadge>` branch regardless of `manualOverride`, admins keep today's behavior.

- [ ] **Step 2: `test-case-row.tsx`** — hide status select, edit, and delete for viewers

Add the import and `const role = useRole();` at the top of `TestCaseRow()`.

Replace the status `<Select>` cell: for `role !== "admin"`, render `<PriorityBadge>`-style read-only text instead — i.e. wrap the existing `<Select>` block in `{role === "admin" ? ( <Select>...</Select> ) : ( <StatusBadge status={testCase.status} /> )}` (import `StatusBadge` from `@/lib/status` alongside the existing `PriorityBadge` import).

Wrap the Actions cell's `<div className="flex items-center gap-1">...</div>` (edit + delete buttons) in `{role === "admin" && ( ... )}`; render nothing (empty `<TableCell />`) for viewers.

- [ ] **Step 3: `dev-field.tsx`** — read-only text for viewers

Add the import and `const role = useRole();` at the top of `DevField()`.

At the start of the return, branch: if `role !== "admin"`, return `<span className="text-sm">{dev ?? "Unassigned"}</span>` instead of the `<Input>`/save-button JSX.

- [ ] **Step 4: `created-date-field.tsx`** — read-only text for viewers

Same pattern as Step 3: add `useRole()`, and if `role !== "admin"`, return `<span className="text-sm">{initial}</span>` instead of the editable input.

- [ ] **Step 5: `created-date-cell.tsx`** — hide the edit popover for viewers

Add `useRole()`. Wrap the `<Popover>...</Popover>` block in `{role === "admin" && ( ... )}`, keeping the `<span>{dateOnlyFormatter.format(createdAt)}</span>` unconditional.

- [ ] **Step 6: `tickets/page.tsx`** — hide "New Ticket" button for viewers

This is a Server Component (async function, no `"use client"`). Add the import: `import { getCurrentUser } from "@/lib/auth/roles";`

At the top of `TicketsPage()`, alongside the existing `await searchParams`:

```ts
  const currentUser = await getCurrentUser();
```

Wrap the "New Ticket" `<Button>` (keep "Test Cases" visible to everyone — it's just navigation):

```tsx
          {currentUser?.role === "admin" && (
            <Button nativeButton={false} render={<Link href="/tickets/new" />}>
              New Ticket
            </Button>
          )}
```

- [ ] **Step 7: `tickets/[id]/page.tsx`** — hide "Add test case" button for viewers

Add the import: `import { getCurrentUser } from "@/lib/auth/roles";`

At the top of `TicketDetailPage()`, after `const { id } = await params;`:

```ts
  const currentUser = await getCurrentUser();
```

Wrap the `<TestCaseDialog ... trigger={<Button>...}` block:

```tsx
            {currentUser?.role === "admin" && (
              <TestCaseDialog
                ticketId={ticket.id}
                trigger={
                  <Button size="sm">
                    <PlusIcon />
                    Add test case
                  </Button>
                }
              />
            )}
```

(`TestCaseHistoryDialog` stays visible — it's read-only.)

- [ ] **Step 8: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 9: Manual check as a viewer**

Using the Users page from Task 8, create a test viewer account. Log in as that viewer in the browser and confirm: no New Ticket / Add test case / Edit / Delete / Retest / manual-override controls are visible anywhere; dev and created-date fields show as plain text; Import and Users are absent from the sidebar; navigating directly to `/import`, `/tickets/new`, or `/users` by URL redirects to `/dashboard`.

- [ ] **Step 10: Commit**

```bash
git add "src/app/(dashboard)/tickets"
git commit -m "Hide edit affordances from viewers across tickets/test-case UI"
```

---

### Task 12: Full verification pass

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all tests pass, including every new file from Tasks 2–7.

- [ ] **Step 2: Lint**

Run: `npx eslint .`
Expected: no errors or warnings.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: succeeds; route table includes `/users`; `/import` and `/tickets/new` still present (now server-guarded).

- [ ] **Step 5: End-to-end manual pass**

Log in as admin: confirm nothing regressed (tickets, test cases, import, dev performance all still work as before). Log in as the test viewer created in Task 11: confirm full read access everywhere and zero write affordances, including direct-URL attempts at admin-only pages.

- [ ] **Step 6: Update the spec status**

In `docs/superpowers/specs/2026-08-01-user-roles-design.md`, change `**Status:** Approved` to `**Status:** Implemented`.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-08-01-user-roles-design.md
git commit -m "Mark user-roles spec as implemented"
```
