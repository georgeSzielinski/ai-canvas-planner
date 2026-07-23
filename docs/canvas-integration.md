# Canvas integration

Phase 3 provides a local-development Canvas personal-access-token adapter, verified connection metadata, idempotent course/assignment/submission synchronization, and an authenticated assignment workspace. It does not schedule study time and does not call an AI provider.

## Create a local token

1. Sign in to the institution's Canvas site.
2. Open **Account → Settings → Approved Integrations**.
3. Select **New Access Token**, enter a narrow development purpose, and use the shortest practical expiry.
4. Copy the token once into an ignored environment file. Never paste it into an issue, chat transcript, screenshot, fixture, browser field, or committed file.

Institution policy controls token availability and lifetime. Sequoia currently limits personal access tokens to 30 days. Canvas or developer-documentation examples do not override that policy. Canvas Sweeper does not infer or display an expiry date because the Canvas profile response does not provide one.

## Configure

For native `make backend`, add these values to ignored `backend/.env`:

```dotenv
CANVAS_SWEEPER_CANVAS_BASE_URL=https://sequoia.instructure.com
CANVAS_SWEEPER_CANVAS_ACCESS_TOKEN=replace-locally
```

For Docker Compose, put the same names in the ignored repository-root `.env`; Compose passes them only to the backend container. No Canvas secret uses a `NEXT_PUBLIC_` name, and the frontend never receives the token.

Optional safety limits have production-oriented defaults:

```dotenv
CANVAS_SWEEPER_CANVAS_REQUEST_TIMEOUT_SECONDS=15
CANVAS_SWEEPER_CANVAS_PAGE_SIZE=100
CANVAS_SWEEPER_CANVAS_MAX_RESPONSE_BYTES=2000000
CANVAS_SWEEPER_CANVAS_MAX_PAGES=50
CANVAS_SWEEPER_CANVAS_MAX_RECORDS=10000
CANVAS_SWEEPER_CANVAS_RETRY_ATTEMPTS=3
CANVAS_SWEEPER_CANVAS_SYNC_LOOKBACK_DAYS=30
CANVAS_SWEEPER_CANVAS_SYNC_LOOKAHEAD_DAYS=365
```

After changing credentials, restart the backend. With Compose:

```bash
docker compose up -d --build --force-recreate backend
```

An empty token is treated as **Not configured**. The environment-token provider is development-only: staging and production reject it at startup so a shared institution identity cannot cross application-user boundaries. A production deployment must install a per-user credential provider. Development/testing permit HTTP only for loopback test servers. The configured URL is server-controlled; users cannot direct requests to arbitrary hosts.

## Verify and synchronize

1. Sign in to Canvas Sweeper.
2. Open **Settings → Connected accounts → Canvas**.
3. Select **Verify connection**. A successful check displays only the safe Canvas display name, Canvas user ID, institution hostname, and verification time.
4. Enable **Include concluded courses** when historical/summer-term data is needed.
5. Select **Sync now**.
6. Review imported courses in the same panel and assignments in **Assignments**.

Course checkboxes control future assignment synchronization. Deselection preserves existing history. If no active courses are returned, the UI recommends concluded-course import without claiming an error or inventing data.

Synchronization is deterministic and idempotent. It paginates all configured reads, prevents overlapping per-user runs, upserts by Canvas ID, retains first-seen history, hashes source fields for change detection, and archives records that disappear only after a successful course read. A failed course preserves its existing assignments and produces a partial report. Canvas-reported `missing`, `late`, `excused`, submitted, and graded state are stored independently; a past due date alone is never treated as missing.

## Token renewal and recovery

When Canvas returns unauthorized, Settings shows **Reconnect required** or **Invalid token**. Create a replacement token under institution policy, replace only the ignored environment value, restart the backend/container, and select **Verify connection** again. No database change is required because the environment token is never stored in the database.

Permission, timeout, rate-limit, unavailable-provider, malformed-response, and partial-sync states are sanitized and shown separately. Provider response bodies and authorization headers are not returned to the browser or persisted in sync diagnostics.

## Security model

- The personal access token is environment-only and represented as a redacted secret in backend settings.
- API responses, connection records, sync reports, test fixtures, browser bundles, and application logs contain no token.
- All Canvas routes require an authenticated application session; mutations additionally use the existing CSRF boundary.
- Every query and unique constraint is application-user scoped.
- Assignment HTML is converted to safe plain text before persistence/display.
- Assignment links and pagination links must remain on the configured Canvas origin.
- Pagination and record limits prevent unbounded imports.
- Only safe idempotent GETs receive bounded transient retries.

## OAuth migration path

The API client depends on a `CanvasCredentialProvider`; the current `EnvironmentCanvasCredentialProvider` is only the local implementation. A later production provider can resolve per-user, per-institution encrypted OAuth credentials without changing pagination, normalization, synchronization, or frontend contracts. That provider should add authorization/callback state, encrypted credential storage, refresh where supported, revocation, institution selection, and multiple connection records per user. Personal access tokens should not become browser-managed or plaintext database fields.
