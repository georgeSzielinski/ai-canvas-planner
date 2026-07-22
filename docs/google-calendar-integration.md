# Google OAuth and Calendar setup

## Google Cloud configuration

1. Create or select a Google Cloud project.
2. Enable Google Calendar API.
3. Configure the OAuth consent screen, application name, support email, privacy URL, and terms URL.
4. Add the smallest supported scopes:
   - `openid`, `email`, `profile`
   - `calendar.calendarlist.readonly`
   - `calendar.events`
   - `calendar.calendars`
5. Create a Web application OAuth client.
6. Add authorized redirect URIs:
   - `http://localhost:8000/api/v1/auth/google/callback`
   - `http://localhost:8000/api/v1/calendar/oauth/callback`
7. For deployment, add the equivalent HTTPS API URLs and set the frontend origin exactly.

Put the client ID and secret in `backend/.env`; never use a `client_secret.json` file in this repository.

## Local secret generation

Generate independent values; do not copy documentation placeholders into a deployed environment.

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
backend/.venv/bin/python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

Use the first output for `CANVAS_SWEEPER_OAUTH_STATE_SECRET` and the second for `CANVAS_SWEEPER_CREDENTIAL_ENCRYPTION_KEY`.

To rotate encryption without forcing reconnects, move the old key into `CANVAS_SWEEPER_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS` under its old version, configure the new key, and increment `CANVAS_SWEEPER_CREDENTIAL_ENCRYPTION_KEY_VERSION`. Credentials are re-encrypted lazily when next used. Remove the old key only after all credential rows have the new `key_version`; removing it earlier requires affected users to reconnect.

## Calendar behavior

Calendar authorization is separate from sign-in and requires explicit onboarding consent. Canvas Sweeper discovers calendars and reports name, provider color, primary status, and read/write capability. The user chooses one study calendar and any number of calendars considered busy.

“Canvas Sweeper Study” can be created through the API. Busy sync reads expanded recurring instances (`singleEvents=true`), ignores cancelled and self-declined events, preserves all-day intervals, and normalizes timestamps with the user’s IANA timezone. It caches only identifiers, times, recurrence identifier, all-day/status flags, and ownership links—no event descriptions.

Sync responses count free blocks and overlapping appointments. A travel conflict is conservatively counted when adjacent events have different locations and less than a 30-minute gap. Provider locations are used only during that in-memory calculation and are never stored.

Publishing is restricted to the selected study calendar. When preview is enabled and automatic publishing is disabled, clients must fetch the study-session preview and submit its short-lived confirmation token before publishing. New events use a deterministic provider ID and receive a private `canvasSweeperSessionId` marker, preventing duplicate inserts during concurrent retries. Updates require both the stored provider event ID and matching private marker and remain bound to the calendar where they were created. Renamed or externally edited events are protected according to user preferences; an event lacking the marker is never modified.

## Recovery

- OAuth denial: return to Settings/Login with an actionable query status.
- Expired credentials: refresh automatically; if refresh fails, reconnect.
- 403: reconnect and approve requested permissions.
- 404: choose another calendar or create a new study calendar.
- 429: wait briefly and retry.
- Google/network outage: retain local settings and retry later.
- Timezone error: choose a valid IANA timezone in Profile.

Disconnect deletes local encrypted credentials. Revoke attempts Google’s revocation endpoint and always deletes local connection data in a `finally` path; if Google is unavailable, the response reports that remote revocation could not be confirmed.
