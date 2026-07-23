# Developer setup

## Prerequisites

- Node.js 22+
- npm 10+
- Python 3.11+
- A Google Cloud Web OAuth client for live Google OAuth validation
- An institution-approved Canvas personal token for optional live Canvas validation

## Install and configure

```bash
make install
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

Populate only the ignored `backend/.env`. Follow `docs/google-calendar-integration.md` to generate independent state/encryption secrets and configure Google redirect URIs. Follow `docs/canvas-integration.md` to configure and renew the environment-only Canvas token. For Compose, put those same Canvas names in the ignored root `.env` and recreate the backend after changes. Validate Compose with `docker compose config --quiet`; the verbose form can render interpolated secrets.

Container builds apply `backend/constraints.lock` for reproducible runtime dependencies. Update and revalidate that lock whenever backend dependency ranges change.

```bash
make migrate
# Optional for a disposable demo database only:
make seed
```

`make seed` is a destructive development reset that replaces all application data. Docker/Compose startup runs migrations without seeding, so restarting a container preserves authenticated workspaces. A narrowly scoped root init service repairs ownership of existing `/data` volumes, exits, and then allows Alembic and the API to run as the non-root application user.

## Run

```bash
make backend   # http://localhost:8000
make frontend  # http://localhost:3000
```

The public routes remain available without a session. Sign in through `/login`; the first Google login redirects to `/onboarding`.

## Quality gates

```bash
make test
make lint
cd frontend && npm run format:check
make build
cd frontend && npm run test:e2e
```

Migration smoke test:

```bash
cd backend
CANVAS_SWEEPER_DATABASE_URL=sqlite:////tmp/canvas-sweeper-migration.sqlite3 .venv/bin/alembic upgrade head
CANVAS_SWEEPER_DATABASE_URL=sqlite:////tmp/canvas-sweeper-migration.sqlite3 .venv/bin/alembic downgrade 20260721_0001
CANVAS_SWEEPER_DATABASE_URL=sqlite:////tmp/canvas-sweeper-migration.sqlite3 .venv/bin/alembic upgrade head
```

## Testing OAuth safely

Backend tests replace the Google provider with an in-process fake. They exercise redirects, sessions, encrypted credential persistence paths, discovery, selection, all-day/recurring/declined events, publication ownership, revocation, and provider errors without network calls or real credentials. A final live test still requires a developer-owned Google test project and test account.

Canvas tests likewise use in-process mocked HTTP responses. They cover authentication failures, pagination/host validation, rate limiting, malformed responses, sanitization, categorization, idempotent synchronization, partial course failures, locking, filtering, and user isolation without using the real token. Live Canvas smoke testing is manual and must never print, log, or copy the token into test commands.
