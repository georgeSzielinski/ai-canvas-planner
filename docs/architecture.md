# Architecture

## Runtime boundaries

Canvas Sweeper is a Next.js App Router frontend backed by a versioned FastAPI API and SQLAlchemy persistence. The browser never receives Google or Canvas credentials. OAuth/session state, encrypted provider credentials, synchronization locks, retry policy, and provider calls remain server-side.

The normal application has one data mode: authenticated backend data. An unauthenticated visitor sees marketing or sign-in states. A new authenticated account receives neutral preferences and otherwise-empty, user-scoped collections. API failures preserve the authenticated identity and previously loaded valid state; they never substitute fixtures.

## Frontend

`frontend/app/` composes routes and metadata. `components/` contains the shell, authentication gates, provider panels, and reusable feedback/form primitives. `features/` contains page-scale experiences. `types/` defines browser domain contracts, while `services/` owns typed API mappings. Components do not scatter raw provider requests.

`AuthProvider` validates the server session and supplies the current user and CSRF state. `ProtectedWorkspace` gates private routes. `AppProvider` hydrates `/workspace/bootstrap` and user-scoped provider endpoints, preserving truthful loading, empty, disconnected, stale, and error states. Test data lives only under test directories and is injected by tests.

## Backend

`backend/app/api/` exposes authenticated, versioned routes. Dependencies resolve the current user before services run. Services scope every query and mutation by that user. Pydantic validates boundaries; SQLAlchemy owns transactions and constraints; Alembic is the only schema-migration mechanism.

The backend currently owns:

- opaque hashed sessions and Google OAuth state;
- encrypted Google Calendar credentials and bounded Calendar synchronization;
- environment-only Canvas credential resolution, safe URL validation, bounded pagination, synchronization locks, and user-scoped import;
- assignment/settings serialization and UTC datetime normalization;
- idempotent, planner-owned Calendar event mappings for existing study-session publication.

Application startup checks readiness and applies migrations through the configured startup command. No startup path inserts sample records, and no production seed command or demo bootstrap endpoint exists.

## Ownership and provider data

Provider-owned Canvas fields are imported as source data. User planning metadata is stored separately or in explicitly user-owned columns and must never overwrite provider truth. Google Calendar operations target only events with durable planner ownership mappings; unrelated events are read only as busy time and are never modified or deleted.

## Time policy

Aware datetimes are converted to UTC before persistence. Provider parsers reject naive datetimes. SQLite-loaded naive UTC values are restored at repository boundaries before comparison or serialization. Local dates, times, weekdays, recurrence, and daylight-saving behavior are interpreted in the user or routine IANA timezone, then converted to UTC intervals for conflict and scheduling operations.

## Deterministic planning direction

Phase 4 adds user-owned routines, preferences, course rules, assignment planning profiles, explainable workload estimation and scoring, availability calculation, versioned schedule drafts, explicit approval, safe publication, rescheduling proposals, and progress tracking. The same normalized source snapshot and settings must produce the same scoring and scheduling output. Heuristics are described as deterministic rules, never as model-generated intelligence.

## Security invariants

- Every private API is authenticated and user-scoped.
- Browser code never receives OAuth secrets, refresh tokens, Canvas tokens, encryption keys, or authorization headers.
- Provider URLs are allowlisted/validated and redirects remain controlled.
- OAuth state, CSRF protections, encrypted credential storage, bounded pagination, finite retries, synchronization locks, and sanitized errors remain mandatory.
- Audit records exclude secrets and unnecessary private calendar content.
- Material schedule or published-event changes require a reviewable proposal and explicit approval.