# AGENTS.md

## Project

Ignis is an Android-first, offline schedule, attendance, and estimated gross-pay tracker. It uses Expo SDK 54, React Native, Expo Router, Expo SQLite, and strict TypeScript.

## Sources of Truth

- `PRODUCT.md` defines product scope, behavior, and accessibility requirements.
- `DESIGN.md` defines the approved visual system and interaction language.
- `SUPABASE.md` defines optional account, OAuth, sync, and account-deletion setup.
- `README.md` defines supported local, build, deployment, and verification commands.

When implementation and documentation disagree, preserve established data and user behavior, then update the relevant source-of-truth document as part of the same change.

## Repository Structure

- `app/`: Expo Router screens and route layouts. Keep route files focused on navigation and screen composition.
- `src/components/`: reusable Ignis UI and interaction components.
- `src/domain/`: pure scheduling, attendance, pay, period, formatting, and validation rules.
- `src/data/`: SQLite persistence, migrations, transactions, OAuth, Supabase, and sync logic.
- `src/providers/`: shared application and feedback state.
- `src/theme/`: design tokens. Reuse these instead of introducing isolated visual values.
- `__tests__/`: Jest and React Native Testing Library coverage; shared fixtures belong in `test-utils/`.
- `supabase/`: server-side migrations and edge functions for optional cloud features.

## Product Invariants

- Local SQLite is authoritative for normal app use. The app must remain fully usable without an account, network connection, or Supabase configuration.
- Supabase sync is optional and must not turn a local write into a network-dependent operation.
- Attendance is a deliberate user decision after a duty ends. Never automatically mark a duty AWOL.
- Estimated pay must remain traceable to scheduled time, unpaid breaks, attendance state, and visible pay settings. Do not present estimates as payroll-grade results.
- Preserve existing completed history and provide non-destructive migrations when stored data changes.
- Android phones are the V1 acceptance target. Maintain system light/dark mode, device-locale formatting, 48 dp touch targets, font scaling, reduced-motion support, screen-reader labels, edge-to-edge insets, non-color status labels, and system Back recovery for unsaved edits.
- Keep UI changes aligned with the Clockwork Ledger design contract in `DESIGN.md`; reuse existing components and tokens before adding new patterns.

## Agent Workflow

- Use applicable repository skills and read their complete instructions before acting.
- For repository exploration, use the available `lean-ctx` tools: call `ctx_compose` first, then prefer `ctx_read`, `ctx_search`, and `ctx_shell` over native equivalents. Use raw output whenever exact text, counts, lines, or quotes are evidence.
- Inspect the worktree before editing. Preserve unrelated user changes and do not modify generated or release artifacts unless the task explicitly requires it.
- At the end of every task, commit only the task's scoped changes and push the commit to the current branch. Never include unrelated worktree changes; report any commit or push failure in the handoff.
- Keep business rules in `src/domain/`, persistence and remote concerns in `src/data/`, and route components thin. Avoid duplicating domain calculations in screens.
- Follow strict TypeScript and the existing `@/*` path alias. Prefer focused, typed changes over broad rewrites.
- Add or update focused tests whenever behavior changes. Cover offline behavior and sync failure paths when touching persistence, accounts, or synchronization.
- Never commit `.env` files, credentials, OAuth secrets, Supabase service-role keys, or other private configuration. Client code may use only documented public Expo environment variables.

## Verification

Run focused tests while developing. For substantial or cross-cutting changes, run all required checks before handing off:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
```

Report which checks ran and any checks that could not run. Do not hide failures that predate the change.
