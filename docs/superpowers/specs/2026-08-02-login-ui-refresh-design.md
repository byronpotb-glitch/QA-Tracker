# Login Page UI Refresh — Design

**Date:** 2026-08-02
**Status:** Approved

## Problem

The login page (`src/app/(auth)/login/page.tsx`) is a bare centered card on a
flat white background, with a plain colored-square "QA" placeholder standing
in for a real brand mark. It works but looks generic — no visual identity,
flat background, default shadcn card styling (hard ring border, neutral
focus rings).

## Goal

Visual polish only — same three form elements (email, password, sign in),
no new functionality, no auth logic changes. Direction: clean and light,
refined rather than a big departure (no split-screen, no dark theme, no new
copy/tagline).

## Logo

`public/logo.png` — the "bQ" mark (navy "b" merged with a blue
magnifying-glass checkmark forming the "Q") — replaces the placeholder
indigo "QA" box in two places:

- **Login page** — the primary brand mark, centered above the card title
  (replacing the current small colored square that sits to the left of the
  title).
- **Sidebar** (`src/app/(dashboard)/app-sidebar.tsx`) — replaces the small
  "QA" box at the top of the nav, same footprint as today (~32px), so the
  mark is consistent from the first screen a user sees through the rest of
  the app.

The source image has a near-white background (not transparent) that's close
enough to the page/card background to blend without a visible box.

## Background treatment

Page background (`src/app/(auth)/login/page.tsx`'s wrapping `div`) moves
from flat white to a soft radial glow: two faint blurred indigo glows, one
near the top-left and one near the bottom-right, on an off-white base —
subtle enough to not compete with the card.

## Card polish

`src/app/(auth)/login/page.tsx` / `login-form.tsx`:

- Softer shadow instead of the current hard `ring-1` border.
- Tighter, more deliberate spacing and type sizing for the title and labels.
- Input focus ring tinted indigo (matching the logo/sidebar accent) instead
  of the default neutral `ring-ring/50`, applied via a scoped className on
  this page rather than changing the shared `Input` component's default
  (avoids affecting focus rings elsewhere in the app).

## Out of scope

No tagline/subtext, no bigger-logo treatment beyond the swap above, no
changes to error message or button loading-state behavior beyond whatever
falls out naturally from the new spacing/type — this is a visual pass, not
a UX-behavior change.

## Testing

Visual only — no new logic to unit test. Verify with `npm run build` (no
route/type regressions) and a manual look at `/login` in the browser
(desktop width; the existing responsive centering already handles small
screens via the same wrapping `flex items-center justify-center` div).
