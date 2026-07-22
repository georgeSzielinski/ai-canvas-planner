# Environment variables

All backend variables use the `CANVAS_SWEEPER_` prefix. Copy examples to ignored local files; never commit populated values.

## Backend

| Variable | Purpose |
|---|---|
| `ENVIRONMENT` | `development`, `testing`, `staging`, or `production`; staging/production enable Secure cookies. |
| `DATABASE_URL` | SQLAlchemy URL. SQLite is local only. |
| `CORS_ORIGINS` | Exact comma-separated frontend origins; credentials are enabled. |
| `FRONTEND_URL` | Redirect target after OAuth. |
| `SESSION_COOKIE_NAME` | Opaque session cookie name. |
| `SESSION_HOURS` | Non-remembered session lifetime. |
| `REMEMBER_SESSION_DAYS` | Remember-login lifetime. |
| `GOOGLE_CLIENT_ID` | Google Web OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Google Web OAuth secret. |
| `GOOGLE_AUTH_REDIRECT_URI` | Identity callback URL. |
| `GOOGLE_CALENDAR_REDIRECT_URI` | Calendar callback URL. |
| `OAUTH_STATE_SECRET` | At least 32 characters; signs short-lived OAuth state. |
| `CREDENTIAL_ENCRYPTION_KEY` | Fernet key encrypting Google access/refresh tokens at rest. |
| `CREDENTIAL_ENCRYPTION_KEY_VERSION` | Positive integer identifying the active Fernet key; increment during rotation. |
| `CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS` | JSON object of prior version-to-key mappings retained temporarily for lazy re-encryption, for example `{"1":"old-fernet-key"}`. |

## Frontend

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Browser-visible versioned API base. Contains no secret. |
| `NEXT_PUBLIC_DATA_MODE` | Use `backend` for the authenticated Phase 2 application. |

Only `NEXT_PUBLIC_` values enter the browser bundle. No OAuth secret, API token, state secret, encryption key, or credential JSON may use that prefix.

See `.env.example`, `backend/.env.example`, and `frontend/.env.example` for names and safe local URLs.
