# Database schema

Alembic is the only schema-change mechanism. Phase 2 head is `20260721_0004`.

## Existing Phase 1 tables

- `user_profiles`: user identity/preferences root, extended in Phase 2.
- `courses`, `assignments`, `study_sessions`: academic graph. Study sessions now carry provider publication metadata.
- `routine_blocks`, `user_settings`, `notifications`, `schedule_proposals`: preserved Phase 1 behavior.

## Phase 2 tables

- `auth_sessions`: opaque session hash, CSRF hash, expiry, remember-login flag, last activity, revocation time.
- `oauth_states`: one-time hashed OAuth nonce, action/user/browser binding, HMAC-protected requester fingerprint for distributed rate limiting, expiry, and consumption timestamp.
- `oauth_state_locks`: singleton transaction lock that serializes OAuth-state admission and bounded cleanup across application workers.
- `calendar_connections`: one Google Calendar account per user, provider identity/status/scopes, selected study calendar, sync/error timestamps.
- `oauth_credentials`: encrypted access/refresh tokens, token type, expiry, scope, and encryption key version. No plaintext token column exists.
- `calendar_preferences`: study/busy calendar IDs plus publishing, reminders, edit protection, weekend, and note policies.
- `busy_event_cache`: minimal read-only availability cache. Stores provider/calendar IDs, start/end, all-day, recurrence ID, and status—not title/body/attendees.
- `calendar_sync_history`: status, counts, timestamps, and bounded recovery details for each sync.

## User profile additions

`google_id`, `email`, `profile_photo`, `onboarding_complete`, bedtime/wake time, rowing schedule, default study duration, preferred calendar, and calendar consent were added while preserving the Phase 1 profile fields and foreign-key root.

## Study event ownership

`study_sessions` adds `calendar_id`, `provider_event_id`, provider ETag, last published payload hash, publication timestamp, and manual-edit lock. These fields support idempotency and prove which remote event Canvas Sweeper may manage.

## Lifecycle

All Phase 2 account/calendar rows are user-owned. Sessions and connection data cascade when their owner/connection is deleted. Calendar preferences are unique per user; credentials are unique per connection; busy cache provider IDs are unique per calendar.

```bash
make migrate
cd backend && .venv/bin/alembic current
```

For production, use PostgreSQL, managed backups, key rotation, and a migration run separate from application startup.
