# Phase 3 Canvas synchronization implementation plan

## Goal

Add a secure, deterministic Canvas ingestion foundation that verifies the environment-provided Sequoia credential, synchronizes user-scoped courses, assignments, and submission state idempotently, and presents the real imported data in the existing workspace design.

## Architecture

1. Add validated Canvas settings and an environment credential provider; no token is persisted or returned.
2. Add a dedicated asynchronous Canvas client with typed payload models, bounded same-origin Link pagination, finite safe retries, rate-limit handling, and sanitized provider errors.
3. Extend persistence with user-scoped Canvas connection state, sync runs, normalized course/assignment source fields, and submission records. Use uniqueness constraints, durable running-state records, and a process-local per-user lock backed by a database running-sync guard.
4. Implement authenticated Canvas status, verification, synchronization, course selection, course listing, assignment listing/detail, and latest-report endpoints. Synchronize each course transactionally so one restricted course can fail without corrupting successful course imports.
5. Add frontend Canvas types/services and connect settings, courses, freshness, sync diagnostics, and assignment filters to live APIs while preserving the existing design system.
6. Add backend, frontend, and mocked end-to-end tests for provider errors, pagination/SSRF boundaries, sanitization, idempotency, partial failure, concurrency, user isolation, categorization, empty states, status badges, freshness, and keyboard behavior.
7. Update configuration, Compose, README, architecture/schema/setup/security/roadmap documentation; then run format, tests, lint/type checks, builds, migrations, Compose validation, mocked smoke tests, secret scans, and an independent final review before commit and push.

## Sprint order

- Sprint 1: configuration, credential abstraction, client, typed provider errors, classification/sanitization tests.
- Sprint 2: migration/models, deterministic upserts, sync reports, concurrency and isolation tests.
- Sprint 3: authenticated API and filters, frontend services/state, settings/courses/assignments UI states.
- Sprint 4: integration/e2e coverage, documentation, Docker validation, security review, complete quality gates, commit, and push.

## Constraints

The environment token stays server-side and is never logged, returned, snapshotted, or stored in application tables. Canvas URLs and pagination links are restricted to the configured origin. Phase 3 imports source data only; it does not estimate study duration or create scheduling decisions. Canvas OAuth is represented by a credential-provider boundary but is deferred to a later phase.
