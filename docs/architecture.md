# Architecture

## Frontend layers

The Next.js App Router owns route composition and metadata. `components/` contains reusable shell, feedback, form, and visual primitives. `features/` contains page-scale domain experiences. `types/domain.ts` is the UI domain contract, while `lib/demo-data.ts` is the only fixture source and `lib/selectors.ts` derives workload and status values.

`AppProvider` remains focused on assignment/session changes, preferences, notifications, theme, proposals, and undo feedback. Phase 2 adds a separate authentication provider that validates the server session, supplies the current user/CSRF value, and redirects protected route groups without mixing identity into demo-domain state. Modal/drawer state stays close to its UI.

The service boundary is `services/`: a typed `ApiClient` and assignment, settings, insights, Canvai, Calendar, and Canvas interfaces isolate wire contracts. Components never scatter raw `fetch` calls. `AppProvider` hydrates the authenticated assignment workspace from user-scoped Canvas endpoints while keeping demo behavior separate.

## Backend layers

`api/routes.py` preserves Phase 1 contracts. `api/auth_routes.py`, `api/user_routes.py`, `api/calendar_routes.py`, and `api/canvas_routes.py` add typed versioned account/provider contracts. Pydantic schemas validate request and response shapes. Services own sessions/OAuth state, encrypted Calendar credentials, Canvas credential resolution/API calls/synchronization, busy-cache normalization, safe publication, assignment serialization, and deterministic classification/proposals. Alembic owns schema changes; `app.db.seed` is an explicit, destructive, idempotent demo reset and is never run during container startup.

The demo user remains explicit (`user-demo`), while Google login creates real user rows. All protected queries are scoped through the authenticated user. Opaque server-side sessions store hashes rather than raw cookie values. Google credentials are encrypted with a deployment-supplied Fernet key. SQLite is only the local default; the SQLAlchemy boundary allows PostgreSQL deployment.

## Data flow

```text
Public page ───────────────────────────────────────────────────────────────┐
Protected page → AuthProvider → credentialed typed service → FastAPI     │
                                                      │                  │
                            session/user/calendar service → SQLAlchemy   │
                                                      │                  │
                                   Google provider adapter → Google APIs │
                                   Canvas API adapter → Canvas APIs      │
Phase 1 domain feature → typed service → fixtures or authenticated API ──┘
```

Dates originate from one fixed demo reference. Selectors compute overdue work, missing work, upcoming work, highest priority, workload, totals, conflicts, completion, and study time by subject.

## Provider integrations and future scheduling

- **Canvas (Phase 3):** the API/sync adapter and development-only environment credential provider are implemented. Reads use same-origin pagination, streamed per-response byte limits, bounded pages/records, timeouts, and retry ceilings. Synchronization uses user-scoped uniqueness, deterministic hashes, a process guard plus a database-enforced one-running-sync constraint, and partial-failure preservation. Staging/production reject the shared environment token; a production OAuth provider can add per-user institutions, encrypted credentials, refresh where supported, revocation, and multiple connections without changing normalization/sync contracts.
- **Google Calendar (Phase 2):** server-side OAuth, encrypted refresh-token storage/refresh, discovery, minimal busy-time cache, idempotent study-event publishing, provider IDs, private ownership markers, and user edit locks are implemented. The product deliberately has no full calendar route.
- **Scheduler:** introduce a deterministic constraint engine between normalized work/routines and schedule proposals. Keep sleep, fixed events, capacity, and explicit locks as hard constraints.
- **Canvai:** replace the demo implementation with a provider-agnostic analysis adapter. Keep deterministic validation, structured proposal schemas, preview/approval, audit history, and undo around any AI output.

## Security boundaries

- Public access is limited to landing, login, privacy, terms, health/readiness, and OAuth callbacks/start routes required to establish identity.
- User data requires a non-expired, non-revoked opaque session; mutations also require the session-bound CSRF value.
- OAuth state is short-lived, HMAC-signed, action-bound, and user-bound for Calendar connection.
- Browser code never receives Google access/refresh tokens or backend secrets.
- Browser code never receives the Canvas token. Canvas HTML is stored as safe plain text; assignment and pagination URLs are restricted to the configured institution origin.
- Busy cache omits event titles/descriptions/attendees. Calendar publication targets only the chosen study calendar and refuses provider events without Canvas Sweeper’s private ownership marker.
- Calendar operations persist user-scoped connection notifications and expose them through authenticated read/mark-read endpoints. Travel-conflict detection uses provider locations only in memory.
