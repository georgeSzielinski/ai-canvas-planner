# Architecture

## Frontend layers

The Next.js App Router owns route composition and metadata. `components/` contains reusable shell, feedback, form, and visual primitives. `features/` contains page-scale domain experiences. `types/domain.ts` is the UI domain contract, while `lib/demo-data.ts` is the only fixture source and `lib/selectors.ts` derives workload and status values.

`AppProvider` remains focused on assignment/session changes, preferences, notifications, theme, proposals, and undo feedback. Phase 2 adds a separate authentication provider that validates the server session, supplies the current user/CSRF value, and redirects protected route groups without mixing identity into demo-domain state. Modal/drawer state stays close to its UI.

The service boundary is `services/`: a typed `ApiClient` and assignment, settings, insights, and Canvai interfaces each offer demo and backend implementations. Components never scatter raw `fetch` calls. A future query/cache layer can replace implementations without changing page composition.

## Backend layers

`api/routes.py` preserves Phase 1 contracts. `api/auth_routes.py`, `api/user_routes.py`, and `api/calendar_routes.py` add typed versioned account and Calendar contracts. Pydantic schemas validate request and response shapes. Services own sessions/OAuth state, encrypted Calendar credentials, provider calls, busy-cache normalization, safe publication, assignment serialization, and deterministic Canvai proposals. Alembic owns schema changes; `app.db.seed` is an explicit, destructive, idempotent demo reset and is never run during container startup.

The demo user remains explicit (`user-demo`), while Google login creates real user rows. All protected queries are scoped through the authenticated user. Opaque server-side sessions store hashes rather than raw cookie values. Google credentials are encrypted with a deployment-supplied Fernet key. SQLite is only the local default; the SQLAlchemy boundary allows PostgreSQL deployment.

## Data flow

```text
Public page ───────────────────────────────────────────────────────────────┐
Protected page → AuthProvider → credentialed typed service → FastAPI     │
                                                      │                  │
                            session/user/calendar service → SQLAlchemy   │
                                                      │                  │
                                   Google provider adapter → Google APIs │
Phase 1 domain feature → typed service → fixtures or authenticated API ──┘
```

Dates originate from one fixed demo reference. Selectors compute overdue work, missing work, upcoming work, highest priority, workload, totals, conflicts, completion, and study time by subject.

## Future integrations

- **Canvas:** add an OAuth/token broker and sync adapter behind a Canvas service. Normalize remote courses, assignments, submissions, and change events into current domain models. Never expose tokens to client JavaScript.
- **Google Calendar (Phase 2):** server-side OAuth, encrypted refresh-token storage/refresh, discovery, minimal busy-time cache, idempotent study-event publishing, provider IDs, private ownership markers, and user edit locks are implemented. The product deliberately has no full calendar route.
- **Scheduler:** introduce a deterministic constraint engine between normalized work/routines and schedule proposals. Keep sleep, fixed events, capacity, and explicit locks as hard constraints.
- **Canvai:** replace the demo implementation with a provider-agnostic analysis adapter. Keep deterministic validation, structured proposal schemas, preview/approval, audit history, and undo around any AI output.

## Security boundaries

- Public access is limited to landing, login, privacy, terms, health/readiness, and OAuth callbacks/start routes required to establish identity.
- User data requires a non-expired, non-revoked opaque session; mutations also require the session-bound CSRF value.
- OAuth state is short-lived, HMAC-signed, action-bound, and user-bound for Calendar connection.
- Browser code never receives Google access/refresh tokens or backend secrets.
- Busy cache omits event titles/descriptions/attendees. Calendar publication targets only the chosen study calendar and refuses provider events without Canvas Sweeper’s private ownership marker.
- Calendar operations persist user-scoped connection notifications and expose them through authenticated read/mark-read endpoints. Travel-conflict detection uses provider locations only in memory.
