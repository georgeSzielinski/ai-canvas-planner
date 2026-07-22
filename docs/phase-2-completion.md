# Phase 2 completion

## What was built

Canvas Sweeper now has Google identity sign-in, opaque revocable sessions, remember-login/logout, first-login onboarding, per-user profiles/settings, protected routes, and a separately consented Google Calendar connection. Users can discover calendars, choose busy and study calendars, create “Canvas Sweeper Study,” import normalized busy intervals, persist Calendar behavior preferences, and publish only Canvas Sweeper-owned study events.

Phase 1 branding, layout, deterministic assignment behavior, and Canvai name/architecture were preserved. No Canvas connection or assignment scheduling engine was added, and no standalone calendar page was created.

## Architecture changes

- Versioned FastAPI routers separate authentication, user, and Calendar contracts from preserved Phase 1 domain routes.
- All user-owned API access is scoped by an authenticated server-side session.
- `AuthProvider` and typed frontend services handle session state, CSRF, onboarding, account controls, and route protection without mixing identity into Phase 1 domain state.
- A provider adapter isolates Google HTTP/OAuth behavior from persistence and route code.
- Calendar service logic owns token refresh, minimal busy normalization/cache, sync history, notifications, preference persistence, and publication ownership checks.
- Busy-sync responses report free blocks, overlaps, and short-gap travel conflicts while keeping provider locations out of persistent storage.
- Alembic revisions `20260721_0002` through `20260721_0004` extend the existing `user_profiles` root and add sessions, one-time OAuth state, requester-scoped rate limiting, and Calendar storage instead of replacing Phase 1 models.

## Security decisions

- Session cookies contain a high-entropy opaque token; only SHA-256 hashes are stored. Sessions expire server-side and are revocable. Production/staging cookies are Secure, HttpOnly, `SameSite=Lax`.
- Authenticated mutations require a separate session-bound CSRF value.
- OAuth state is HMAC-signed, action-bound, stored as a one-time hashed nonce, user-bound for Calendar, browser-bound for identity login, rejects future-issued timestamps, and expires after ten minutes.
- Expired and consumed OAuth-state rows are removed during state creation. A singleton database lock serializes admission across workers; HMAC-protected requester fingerprints enforce a per-client active-state limit, while bounded oldest-state eviction prevents global storage growth without exposing a globally fillable sign-in lockout threshold.
- Identity and Calendar consent are separate. Calendar connect requires explicit onboarding consent.
- Google access/refresh tokens are encrypted with a deployment-provided, versioned Fernet key and are never included in API/frontend responses. Previous key versions support lazy credential re-encryption during rotation.
- Busy cache stores no title, description, location, organizer, or attendees.
- Event locations are consumed only in memory for short-gap travel-conflict detection.
- Published events carry a private Canvas Sweeper session marker. Existing provider events are updated only when the stored provider ID and marker both match; rename/etag protections honor user preferences.
- Secrets and populated environment files remain ignored. Examples contain variable names and local callback URLs only.

## Database changes

Added `auth_sessions`, `calendar_connections`, `oauth_credentials`, `calendar_preferences`, `busy_event_cache`, and `calendar_sync_history`. Extended `user_profiles` with Google identity/onboarding fields and `study_sessions` with remote publication metadata. See `docs/database-schema.md`.

## Validation

Automated validation covers anonymous/protected routes, Google login callback, cookie persistence, CSRF, logout/revocation, onboarding/profile persistence, Calendar consent/connect/reconnect/disconnect/revoke paths, encrypted credentials, discovery/selection, study-calendar creation, declined/all-day/recurring busy events, sync/provider errors, settings persistence, publication ownership, and all Phase 1 regressions.

The migration has been exercised from an empty database to head, from the Phase 1 revision to head, and through a `0004 → 0003 → 0004` downgrade/upgrade cycle. `alembic check` reports no pending schema operations. Validation completed with 45 backend tests, 39 frontend unit/component tests, and 8 backend-mode Playwright desktop/mobile/accessibility tests passing; the accessibility suite also passed five repeated runs. Ruff, mypy, ESLint, TypeScript, Prettier, the frontend production build, split-origin CSRF browser coverage, and repository secret scanning also passed.

## Known limitations

- Live Google consent and Calendar API calls require a developer-owned Google Cloud OAuth client and test account. The repository has no credentials by design; automated provider-contract tests use an in-process fake and cannot prove a specific deployment’s Google consent-screen configuration.
- Sync is request-driven; background/periodic sync, webhook channels, retry queues, and distributed rate limiting are future reliability work.
- SQLite is for local development. Production should use PostgreSQL, managed backups, centralized key management/rotation, HTTPS, and a deployment migration job.
- Account export/deletion and formal retention tooling remain privacy follow-up work.
- The Phase 1 assignment dataset remains deterministic until Canvas integration. No assignment-to-calendar scheduling logic exists in Phase 2.

## Future Canvas integration points

Phase 3 can add a server-side Canvas OAuth/token broker and adapter beside the Google provider adapter. Imported courses, assignments, submissions, and change events should normalize into existing user-owned models. The deterministic scheduler should consume assignments plus `busy_event_cache`, produce previewable proposals, and publish approved sessions through the existing ownership-safe Calendar service. Canvas credentials must remain backend-only, encrypted, independently revocable, and excluded from Canvai provider prompts.

## Phase 3 readiness

The user identity boundary, ownership-scoped persistence, onboarding preferences, Calendar availability cache, selected study calendar, publication metadata, typed service contracts, and migration path are ready for Canvas normalization and deterministic scheduling. Live Google OAuth sign-off and production infrastructure hardening remain deployment gates rather than Phase 3 domain work.
