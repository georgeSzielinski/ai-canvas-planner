# Developer setup

## Prerequisites

- Node.js 22+
- npm 10+
- Python 3.11+
- A Google Cloud Web OAuth client for live OAuth validation

## Install and configure

```bash
make install
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

Populate only the ignored `backend/.env`. Follow `docs/google-calendar-integration.md` to generate independent state/encryption secrets and configure Google redirect URIs.

```bash
make migrate
# Optional for a disposable demo database only:
make seed
```

`make seed` is a destructive development reset that replaces all application data. Docker/Compose startup runs migrations without seeding, so restarting a container preserves authenticated workspaces.

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
