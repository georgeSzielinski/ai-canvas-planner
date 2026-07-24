# Phase 3 completion

Phase 3 establishes the production-oriented Canvas ingestion foundation while intentionally stopping before scheduling or AI duration estimation.

## Delivered

- Typed, redacted backend Canvas settings and an environment credential provider behind a replaceable provider protocol.
- Async bearer-token Canvas client with streamed per-response byte limits, bounded timeout/retries, Link pagination, maximum-page/record guards, same-origin pagination enforcement, safe errors, and typed response validation.
- Authenticated profile verification with safe identity/hostname/freshness state and explicit invalid-token, permission, rate-limit, timeout, unavailable, and malformed-response recovery states.
- Alembic revision `20260722_0005` with user-scoped connection/sync/submission tables and normalized Canvas course/assignment fields, uniqueness constraints, source hashes, first/last-seen timestamps, and non-destructive archive state.
- Per-user process and database synchronization guards, interrupted-run recovery, deterministic upserts, per-course transaction commits, rollback/preservation on partial failure, and structured reports.
- Authenticated status/verify/sync/report/course-selection/course-list/assignment-list/detail APIs with deterministic filtering, pagination, sorting, and application-user isolation.
- Safe HTML-to-text normalization, same-institution assignment links, and deterministic explainable assignment categories without external AI calls.
- Settings integration status, environment credential guidance, concluded-course control, course selection/counts, freshness and partial-sync states, plus a responsive real assignment workspace with Canvas/source state and safe external links.
- Reproducible runtime constraints, secret-excluding Docker contexts, non-root application processes, minimal standalone frontend image, local-only port bindings, health-gated Compose startup, and Canvas environment passthrough restricted to the backend.

## Validation

Validated on 2026-07-22:

- `make test`: 52 frontend Vitest cases and 105 backend Pytest cases passed.
- `make lint`: ESLint, TypeScript, Ruff, and mypy passed.
- `make build`: Next.js production build passed.
- `cd frontend && npm run format:check`: passed.
- `cd backend && .venv/bin/ruff format --check app tests alembic`: passed.
- `cd frontend && npm run test:e2e`: 10 Playwright desktop/mobile/accessibility flows passed with mocked Canvas responses.
- Fresh SQLite `alembic upgrade head`: reached `20260722_0005`.
- SQLite downgrade with an imported null-due-date assignment: safely reached `20260721_0004`; the Phase 2 data-loss policy removes incompatible assignments and their dependent study sessions.
- `docker compose config --quiet`, image builds, container startup, backend readiness, and frontend HTTP smoke test passed; smoke containers were then stopped.
- `npm audit --omit=dev --audit-level=high`, `pip-audit`, and `pip check`: no known vulnerabilities or broken requirements reported.
- Live Canvas identity verification against the configured Sequoia origin succeeded without exposing or persisting the credential.

The post-release datetime hardening normalizes aware Canvas timestamps to UTC before persistence, restores SQLite-loaded naive UTC values at comparison and serialization boundaries, and rejects naive provider timestamps. Authenticated clients load `/workspace/bootstrap`; the obsolete demo bootstrap route has been removed.

Automated tests and E2E fixtures contain no real Canvas credential. Live provider identity verification passed using the ignored local credential; a complete browser login-and-sync acceptance run remains an operator step because it requires an authenticated developer account. See `docs/canvas-integration.md`.

## Known boundaries

- The current personal token is environment-scoped for local development, so all local users resolve the same Canvas identity. Staging and production reject this provider at startup; a production multi-user release must supply a per-user Canvas OAuth credential provider.
- Synchronization is request-triggered. A database-enforced one-running-sync-per-user constraint protects multiple application workers; a later reliability phase should add a durable job queue for scheduled/background runs.
- Canvas does not disclose the institution-managed personal-token expiry through the profile response, so the UI reports invalid/expired status only after Canvas rejects it and never invents an expiry date.
- No assignment duration estimates, milestones, study sessions, or scheduling decisions are generated from imported Canvas data in this phase.

## Next phase

Phase 4 should implement a deterministic scheduling engine over the normalized Phase 3 data. It should treat Canvas due/unlock/lock/submission state, user routines, Calendar busy blocks, sleep/recovery, capacity, and explicit user locks as explainable constraints, while preserving preview/approval and never letting an AI provider directly mutate schedules.
