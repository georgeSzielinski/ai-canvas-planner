# Canvas Sweeper

Canvas Sweeper is an academic planning foundation that turns assignment deadlines into a realistic study plan. Canvai, its planning assistant, reasons about workload, rowing, school, commuting, meals, lifting, free time, and protected sleep.

Phase 3 adds a secure, server-side Canvas connection and idempotent course, assignment, and submission synchronization to the authenticated Phase 2 foundation. Assignment scheduling logic and external AI remain intentionally out of scope.

## What is included

- Next.js 16 App Router frontend with strict TypeScript, React 19, Geist, Phosphor icons, CSS design tokens, responsive layouts, light/dark/system themes, accessibility basics, local persistence, and deterministic fixtures.
- Landing, Overview, Assignments, Canvai, Insights, Settings, and not-found experiences.
- Interactive assignment filters/details/status/estimates/sessions, manual assignment entry, notifications, routine editor, settings save/reset, and Canvai preview/apply/edit/dismiss/undo.
- FastAPI API with Pydantic schemas, SQLAlchemy models, Alembic migration, SQLite development persistence, deterministic seed, local-origin CORS, and versioned endpoints.
- Google OpenID Connect, opaque server-side sessions, remember-login/logout, CSRF protection, first-login onboarding, user profiles, and protected frontend/API routes.
- Separately consented Google Calendar OAuth with encrypted credentials, refresh, discovery/selection, minimal busy-time caching, study-calendar creation, and ownership-safe study-event publishing.
- Environment-backed local Canvas verification, bounded/retried API reads, user-scoped normalized persistence, partial-safe synchronization, course controls, deterministic assignment categorization, and a real assignment workspace.
- Vitest/Testing Library, Playwright, Pytest, ESLint, Prettier, Ruff, and mypy configuration.

## Prerequisites

- Node.js 22 or newer (validated with Node 26)
- npm 10 or newer
- Python 3.11 or newer (validated with Python 3.14)

## Install

```bash
make install
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
# Configure Google OAuth/Calendar and optional local Canvas credentials; see docs below.
make migrate
```

Populate only the ignored `backend/.env`. Do not add OAuth secrets, Canvas tokens, API keys, credential JSON, session secrets, access tokens, or refresh tokens to source control.
Container startup runs migrations but never seeds or resets persisted data.

## Run locally

Terminal 1:

```bash
make backend
```

Terminal 2:

```bash
make frontend
```

Open <http://localhost:3000>. API docs are at <http://localhost:8000/docs>. Docker is optional: `make dev` starts both services with Compose.

## Quality commands

```bash
make test                 # frontend unit/component + backend tests
make lint                 # ESLint, TypeScript, Ruff, and mypy
make format               # Prettier and Ruff formatting/fixes
make build                # Next.js production build
make migrate              # alembic upgrade head
cd frontend && npm run test:e2e
```

## API

- `GET /health`
- `GET /ready`
- `GET /api/v1/auth/session`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`
- `GET /api/v1/auth/google/start`, `GET /api/v1/auth/google/callback`
- `GET/PATCH /api/v1/user/profile`, `PUT /api/v1/user/onboarding`
- `GET /api/v1/notifications`, `POST /api/v1/notifications/{notification_id}/read`
- `GET /api/v1/calendar/status`, `GET /api/v1/calendar/connect`, `GET /api/v1/calendar/oauth/callback`
- `POST /api/v1/calendar/disconnect`, `POST /api/v1/calendar/revoke`
- `GET /api/v1/calendar/calendars`, `POST /api/v1/calendar/study-calendar`
- `POST /api/v1/calendar/sync-busy`, `GET/PATCH /api/v1/calendar/preferences`
- `GET /api/v1/calendar/study-sessions/{session_id}/preview`
- `POST /api/v1/calendar/study-sessions/{session_id}/publish`
- `GET /api/v1/canvas/status`, `POST /api/v1/canvas/verify`, `POST /api/v1/canvas/sync`
- `GET /api/v1/canvas/sync/latest`, `GET /api/v1/canvas/courses`
- `PATCH /api/v1/canvas/courses/{course_id}`
- `GET /api/v1/canvas/assignments`, `GET /api/v1/canvas/assignments/{assignment_id}`
- `GET /api/v1/assignments`
- `GET /api/v1/assignments/{assignment_id}`
- `PATCH /api/v1/assignments/{assignment_id}`
- `GET /api/v1/settings`
- `PATCH /api/v1/settings`

Error responses retain FastAPI's `detail` field for compatibility and also include stable `error.code` and `error.message` fields for clients.

## Repository structure

```text
frontend/          Next.js UI, domain types, authenticated state, services, and tests
backend/           FastAPI, Pydantic, SQLAlchemy, Alembic, and tests
docs/              Architecture, design system, completion notes, and roadmap
scripts/           Reserved for cross-project automation
```

See [architecture](docs/architecture.md), [database schema](docs/database-schema.md), [authentication flow](docs/authentication-flow.md), [Google Calendar setup](docs/google-calendar-integration.md), [Canvas setup and renewal](docs/canvas-integration.md), [environment variables](docs/environment-variables.md), [developer setup](docs/developer-setup.md), [Phase 3 completion](docs/phase-3-completion.md), and [roadmap](docs/roadmap.md).

## Safety and known limitations

SQLite files and all populated `.env` variants are ignored. Google credentials remain backend-only and encrypted at rest. The local Canvas token remains environment-only and never enters API responses or browser bundles. The busy cache deliberately omits event content; Canvas assignment HTML is reduced to safe plain text. The scheduling engine is not implemented, and no Canvas data is sent to an AI provider. A real Google Cloud test project/account and institution-approved Canvas token are required for live-provider validation outside automated fake-provider suites. Canvas OAuth, production deployment, background sync, PostgreSQL, managed key rotation, and privacy operations remain later reliability work.

Busy sync reports imported busy blocks, free-block counts, overlapping appointments, and short-gap travel conflicts. Event locations are used only in memory for travel-conflict detection and are never cached.

The project is independent and is not affiliated with Instructure Canvas or Google.
