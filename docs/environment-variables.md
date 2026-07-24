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
| `CANVAS_BASE_URL` | Server-controlled Canvas institution origin. HTTPS is required outside local development/testing. |
| `CANVAS_ACCESS_TOKEN` | Local-development personal access token. Environment-only; never returned or persisted. Empty means not configured. |
| `CANVAS_REQUEST_TIMEOUT_SECONDS` | Per-request timeout; defaults to 15 seconds. |
| `CANVAS_PAGE_SIZE` | Requested Canvas page size; defaults to Canvas's supported maximum of 100. |
| `CANVAS_MAX_RESPONSE_BYTES` | Maximum bytes accepted from one Canvas response before parsing; defaults to 2,000,000. |
| `CANVAS_MAX_PAGES` | Pagination guard; defaults to 50 pages. |
| `CANVAS_MAX_RECORDS` | Per-list record guard; defaults to 10,000 records. |
| `CANVAS_RETRY_ATTEMPTS` | Retry ceiling for safe Canvas reads; defaults to 3. |
| `CANVAS_SYNC_LOOKBACK_DAYS` | Assignment sync window before today; defaults to 30 days. |
| `CANVAS_SYNC_LOOKAHEAD_DAYS` | Assignment sync window after today; defaults to 365 days. |

## Frontend

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Browser-visible versioned API base. Contains no secret. |

Only `NEXT_PUBLIC_` values enter the browser bundle. No OAuth secret, Canvas token, API token, state secret, encryption key, or credential JSON may use that prefix. Native backend startup reads ignored `backend/.env`; Docker Compose reads the ignored root `.env` and passes Canvas values only to the backend service.

See `.env.example`, `backend/.env.example`, and `frontend/.env.example` for names and safe local URLs.
