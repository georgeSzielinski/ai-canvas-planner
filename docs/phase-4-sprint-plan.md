# Phase 4 sprint plan and execution ledger

Updated: 2026-07-23

## Operating rules

- Complete one narrow, independently testable sprint at a time.
- Use RED-GREEN-REFACTOR for scheduling behavior.
- Run targeted tests during each sprint and `make test`, `make lint`, and `make build` before each milestone commit.
- Preserve strict user isolation, UTC persistence, provider ownership, explicit approval, and deterministic output.
- Never insert sample data in normal runtime paths or substitute fixtures after an API failure.
- Never publish a draft or materially rewrite planner-owned Google events without explicit approval.
- Update this ledger with evidence, commit hash, and the next safe sprint.

## Sprint sequence

### Sprint 0 — Production-data integrity

Status: implemented; milestone validation passed pending commit.

- Remove production demo bootstrap, seed command, fixture services, fake dashboard/insight/proposal data, sample identity fallbacks, and data-mode switching.
- Move fixtures under isolated test directories.
- Give new authenticated users neutral preferences and empty user-scoped collections.
- Add backend and frontend release regressions for the no-demo invariant.
- Replace unsupported planning/insight simulations with truthful empty states.

Validation: frontend 55 tests passed; backend 104 tests passed; ESLint, TypeScript, Ruff, mypy, and Next.js production build passed.

### Sprint 1 — Scheduling data model and authenticated CRUD

Status: next.

- Add user-owned recurring routines with cross-midnight validation and activation lifecycle.
- Extend per-user scheduling preferences.
- Add per-course rules and assignment planning profiles without overwriting Canvas-owned fields.
- Add Alembic migration, constraints, schemas, repositories/services, APIs, and isolation tests.
- Add frontend services and accessible CRUD/preferences/profile controls using existing design primitives.

### Sprint 2 — Deterministic estimates and explainable priority

- Implement versioned workload-estimation rules and origin precedence; user estimates always win.
- Implement versioned factorized priority scoring, warnings, explanations, missing-work precedence, and early test/project treatment.
- Add deterministic, edge-case, and override tests plus algorithm documentation.

### Sprint 3 — Availability engine

- Normalize routines, sleep, buffers, selected Google busy calendars, planner sessions, daily limits, and user timezone into traceable blocked/free intervals.
- Handle overlap, adjacency, all-day/recurring/private/canceled/duplicate events, cross-midnight intervals, DST, short gaps, and no-availability cases.
- Add exhaustive timezone and conflict tests.

### Sprint 4 — Schedule generator and versioned drafts

- Add stable deterministic placement, splitting, breaks, daily limits, early distribution, locks, deadlines/unlocks, regeneration, and impossible-work reporting.
- Persist versioned drafts, sessions, warnings, unscheduled items, explanations, input/settings snapshots, lineage, and statuses.
- Add draft lifecycle/edit/approval/regeneration APIs and tests.

### Sprint 5 — Planning workspace

- Build date-based and assignment-based draft views, workload summary, warnings, explanations, edit/move/lock/reject/approve controls, and regeneration flows.
- Preserve the design system and add responsive, keyboard, accessibility, loading, empty, disconnected, stale, and error coverage.

### Sprint 6 — Safe Google Calendar publication

- Publish only approved planner-owned sessions to the selected calendar.
- Add durable mappings, idempotency, retry/partial-failure state, audit history, externally deleted/moved event handling, and deletion safety.
- Never modify unrelated events or report full success after partial failure.

### Sprint 7 — Rescheduling, progress, and real dashboard

- Add reviewable change proposals for source/config/calendar/progress changes.
- Track not-started/in-progress/completed/partial/skipped sessions, actual duration, notes, and remaining workload.
- Compute every dashboard value from real provider/planner data and surface freshness and warning state.

### Sprint 8 — Final hardening and release

- Validate clean and upgrade migrations from both fresh and Phase 3 databases.
- Run full tests, format, lint, typing, production build, Compose checks, audits, E2E accessibility/mobile flows, and targeted security review.
- Repeat demo/hardcode, deterministic-output, user-isolation, timezone, and Calendar ownership/deletion-safety audits.
- Finish README/architecture/schema/algorithm/workflow/security/troubleshooting/status documentation.
- Commit and push logical milestones; confirm local `main` equals `origin/main` and the worktree is clean.
