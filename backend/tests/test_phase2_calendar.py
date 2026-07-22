from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.auth_routes import get_google_provider
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.main import app
from app.models import BusyEventCache, CalendarConnection, OAuthCredential
from app.services.calendar import CredentialCipher
from app.services.google import CALENDAR_SCOPES, GoogleProviderError

TEST_ENCRYPTION_KEY = Fernet.generate_key().decode("ascii")
TEST_SETTINGS = Settings(
    environment="testing",
    google_client_id="test-client",
    google_client_secret="test-secret",
    oauth_state_secret="state-secret-that-is-long-enough-for-tests",
    credential_encryption_key=TEST_ENCRYPTION_KEY,
)


class FakeGoogleProvider:
    def __init__(self) -> None:
        self.events: dict[str, dict[str, object]] = {}
        self.revoked = False
        self.last_read_calendar_id: str | None = None

    def configured(self) -> bool:
        return True

    def authorization_url(
        self,
        *,
        state: str,
        redirect_uri: str,
        scopes: list[str],
        prompt: str | None = None,
    ) -> str:
        return f"https://accounts.google.test/auth?state={state}&redirect_uri={redirect_uri}"

    def exchange_code(self, code: str, redirect_uri: str) -> dict[str, object]:
        assert code == "calendar-code"
        return {
            "access_token": "access-secret",
            "refresh_token": "refresh-secret",
            "expires_in": 3600,
            "scope": " ".join(CALENDAR_SCOPES),
            "token_type": "Bearer",
        }

    def userinfo(self, access_token: str) -> dict[str, object]:
        assert access_token == "access-secret"
        return {
            "sub": "google-calendar-user",
            "email": "maya@example.test",
            "email_verified": True,
        }

    def refresh_token(self, refresh_token: str) -> dict[str, object]:
        assert refresh_token == "refresh-secret"
        return {"access_token": "refreshed-secret", "expires_in": 3600}

    def list_calendars(self, access_token: str) -> list[dict[str, object]]:
        assert access_token in {"access-secret", "refreshed-secret"}
        return [
            {
                "id": "primary",
                "summary": "Maya",
                "backgroundColor": "#4285f4",
                "primary": True,
                "accessRole": "owner",
            },
            {
                "id": "school",
                "summary": "School",
                "backgroundColor": "#7ae7bf",
                "accessRole": "reader",
            },
        ]

    def create_calendar(self, access_token: str, name: str, timezone: str) -> dict[str, object]:
        assert name == "Canvas Sweeper Study"
        assert timezone == "America/Los_Angeles"
        return {"id": "study-calendar", "summary": name, "backgroundColor": "#1d4ed8"}

    def list_events(
        self,
        access_token: str,
        calendar_id: str,
        time_min: str,
        time_max: str,
    ) -> list[dict[str, object]]:
        assert calendar_id in {"primary", "school"}
        if calendar_id == "school":
            return [
                {
                    "id": "declined",
                    "status": "confirmed",
                    "start": {"dateTime": "2026-09-17T10:00:00-07:00"},
                    "end": {"dateTime": "2026-09-17T11:00:00-07:00"},
                    "attendees": [
                        {"self": True, "responseStatus": "declined"},
                    ],
                }
            ]
        return [
            {
                "id": "transparent-free-time",
                "status": "confirmed",
                "transparency": "transparent",
                "start": {"dateTime": "2026-09-17T12:00:00-07:00"},
                "end": {"dateTime": "2026-09-17T13:00:00-07:00"},
            },
            {
                "id": "all-day",
                "status": "confirmed",
                "start": {"date": "2026-09-18"},
                "end": {"date": "2026-09-19"},
            },
            {
                "id": "recurring-instance",
                "status": "confirmed",
                "recurringEventId": "rowing-series",
                "start": {"dateTime": "2026-09-17T16:30:00-07:00"},
                "end": {"dateTime": "2026-09-17T19:00:00-07:00"},
            },
        ]

    def insert_event(
        self, access_token: str, calendar_id: str, payload: dict[str, object]
    ) -> dict[str, object]:
        event = {**payload, "id": "study-event-1", "etag": "etag-1"}
        self.events["study-event-1"] = event
        return event

    def get_event(self, access_token: str, calendar_id: str, event_id: str) -> dict[str, object]:
        self.last_read_calendar_id = calendar_id
        return self.events[event_id]

    def update_event(
        self,
        access_token: str,
        calendar_id: str,
        event_id: str,
        payload: dict[str, object],
    ) -> dict[str, object]:
        event = {**payload, "id": event_id, "etag": "etag-2"}
        self.events[event_id] = event
        return event

    def revoke(self, token: str) -> None:
        self.revoked = True


def configure_provider(provider: FakeGoogleProvider) -> None:
    app.dependency_overrides[get_settings] = lambda: TEST_SETTINGS
    app.dependency_overrides[get_google_provider] = lambda: provider


def onboarding_payload() -> dict[str, object]:
    return {
        "school_year": "Junior",
        "timezone": "America/Los_Angeles",
        "week_starts_on": "monday",
        "bedtime": "22:30",
        "wake_time": "06:30",
        "rowing_schedule": [{"day": "Tuesday", "start": "16:30", "end": "19:00"}],
        "default_study_duration": 45,
        "preferred_calendar": "primary",
        "calendar_consent": True,
    }


def connect(client: TestClient, provider: FakeGoogleProvider) -> None:
    configure_provider(provider)
    assert client.put("/api/v1/user/onboarding", json=onboarding_payload()).status_code == 200
    start = client.get("/api/v1/calendar/connect", follow_redirects=False)
    assert start.status_code == 302
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    callback = client.get(
        "/api/v1/calendar/oauth/callback",
        params={"state": state, "code": "calendar-code"},
        follow_redirects=False,
    )
    assert callback.status_code == 302
    assert callback.headers["location"].endswith("/settings?calendar=connected")


def test_session_persists_and_csrf_is_enforced(client: TestClient) -> None:
    first = client.get("/api/v1/auth/session")
    second = client.get("/api/v1/auth/session")
    assert first.status_code == second.status_code == 200
    assert first.json()["authenticated"] is True
    assert first.json()["csrf_token"] == "test-csrf-token"

    client.headers.pop("X-CSRF-Token")
    denied = client.patch("/api/v1/settings", json=client.get("/api/v1/settings").json())
    assert denied.status_code == 403
    assert denied.json()["detail"] == "Invalid CSRF token"


def test_profile_and_onboarding_persist(client: TestClient) -> None:
    response = client.put("/api/v1/user/onboarding", json=onboarding_payload())
    assert response.status_code == 200
    assert response.json()["onboarding_complete"] is True
    assert response.json()["timezone"] == "America/Los_Angeles"
    profile = client.patch(
        "/api/v1/user/profile",
        json={"display_name": "Maya Calendar", "preferred_theme": "dark"},
    )
    assert profile.status_code == 200
    assert client.get("/api/v1/user/profile").json()["display_name"] == "Maya Calendar"


def test_calendar_connection_rejects_partial_scope_grants(client: TestClient) -> None:
    class PartialScopeProvider(FakeGoogleProvider):
        def exchange_code(self, code: str, redirect_uri: str) -> dict[str, object]:
            payload = super().exchange_code(code, redirect_uri)
            payload["scope"] = CALENDAR_SCOPES[0]
            return payload

    provider = PartialScopeProvider()
    configure_provider(provider)
    assert client.put("/api/v1/user/onboarding", json=onboarding_payload()).status_code == 200
    start = client.get("/api/v1/calendar/connect", follow_redirects=False)
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    callback = client.get(
        "/api/v1/calendar/oauth/callback",
        params={"state": state, "code": "calendar-code"},
        follow_redirects=False,
    )

    assert callback.status_code == 302
    assert "calendar_error=missing_permissions" in callback.headers["location"]
    assert client.get("/api/v1/calendar/status").json()["connected"] is False


def test_calendar_connection_discovery_selection_sync_and_publish(client: TestClient) -> None:
    provider = FakeGoogleProvider()
    connect(client, provider)

    status = client.get("/api/v1/calendar/status")
    assert status.status_code == 200
    assert status.json()["connected"] is True
    assert "calendar.events" in " ".join(status.json()["permissions"])
    assert "access-secret" not in status.text
    assert "refresh-secret" not in status.text
    notifications = client.get("/api/v1/notifications")
    assert notifications.status_code == 200
    connected_notice = next(
        item for item in notifications.json() if item["title"] == "Calendar connected"
    )
    marked_read = client.post(f"/api/v1/notifications/{connected_notice['id']}/read")
    assert marked_read.status_code == 200
    assert marked_read.json()["read"] is True

    session_dependency = app.dependency_overrides[get_db]
    session_generator = session_dependency()
    database = next(session_generator)
    credential = database.scalar(select(OAuthCredential))
    assert credential is not None
    credential.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    database.commit()
    session_generator.close()

    calendars = client.get("/api/v1/calendar/calendars")
    assert calendars.status_code == 200
    assert calendars.json()[0] == {
        "id": "primary",
        "name": "Maya",
        "color": "#4285f4",
        "primary": True,
        "access_role": "owner",
        "can_read": True,
        "can_write": True,
        "selected_for_busy": False,
        "selected_for_study": False,
    }

    preferences = {
        "study_calendar_id": "primary",
        "busy_calendar_ids": ["primary", "school", "primary"],
        "publish_automatically": False,
        "preview_before_publishing": True,
        "default_reminder_minutes": 15,
        "default_event_color": "#1d4ed8",
        "protect_manually_edited_events": True,
        "preserve_renamed_events": True,
        "canvai_may_move_study_sessions": True,
        "allow_weekend_scheduling": True,
        "include_preparation_notes": True,
    }
    saved = client.patch("/api/v1/calendar/preferences", json=preferences)
    assert saved.status_code == 200
    assert saved.json()["busy_calendar_ids"] == ["primary", "school"]
    assert client.get("/api/v1/calendar/preferences").json() == saved.json()

    created = client.post("/api/v1/calendar/study-calendar", json={"name": "Canvas Sweeper Study"})
    assert created.status_code == 200
    assert created.json()["id"] == "study-calendar"

    now = datetime(2026, 9, 16, tzinfo=UTC)
    synced = client.post(
        "/api/v1/calendar/sync-busy",
        json={
            "time_min": now.isoformat(),
            "time_max": (now + timedelta(days=7)).isoformat(),
        },
    )
    assert synced.status_code == 200
    sync_body = synced.json()
    assert sync_body["imported_count"] == 2
    assert sync_body["all_day_count"] == 1
    assert sync_body["recurring_count"] == 1
    assert sync_body["free_block_count"] >= 0
    assert sync_body["travel_conflict_count"] >= 0
    assert sync_body["overlapping_appointment_count"] == sync_body["conflicts"]
    assert {event["provider_event_id"] for event in sync_body["events"]} == {
        "all-day",
        "recurring-instance",
    }

    session_dependency = app.dependency_overrides[get_db]
    session_generator = session_dependency()
    database = next(session_generator)
    connection = database.scalar(select(CalendarConnection))
    assert connection is not None
    database.add(
        BusyEventCache(
            id="busy-outside-requested-range",
            user_id=connection.user_id,
            connection_id=connection.id,
            calendar_id="primary",
            provider_event_id="outside-requested-range",
            starts_at=now + timedelta(days=20),
            ends_at=now + timedelta(days=20, hours=1),
        )
    )
    database.commit()
    session_generator.close()
    assert (
        client.post(
            "/api/v1/calendar/sync-busy",
            json={
                "time_min": now.isoformat(),
                "time_max": (now + timedelta(days=7)).isoformat(),
            },
        ).status_code
        == 200
    )
    session_generator = session_dependency()
    database = next(session_generator)
    assert database.get(BusyEventCache, "busy-outside-requested-range") is not None
    session_generator.close()

    blocked = client.post("/api/v1/calendar/study-sessions/session-seminar-1/publish", json={})
    assert blocked.status_code == 409
    preview = client.get("/api/v1/calendar/study-sessions/session-seminar-1/preview")
    assert preview.status_code == 200
    assert preview.json()["title"] == "AP Seminar — draft"
    published = client.post(
        "/api/v1/calendar/study-sessions/session-seminar-1/publish",
        json={"confirmation_token": preview.json()["confirmation_token"]},
    )
    assert published.status_code == 200
    assert published.json()["action"] == "created"
    assert provider.events["study-event-1"]["extendedProperties"] == {
        "private": {"canvasSweeperSessionId": "session-seminar-1"}
    }
    assert provider.events["study-event-1"]["colorId"] == "9"

    provider.events["study-event-1"]["extendedProperties"] = {
        "private": {"canvasSweeperSessionId": "someone-elses-session"}
    }
    refused = client.post(
        "/api/v1/calendar/study-sessions/session-seminar-1/publish",
        json={"confirmation_token": preview.json()["confirmation_token"]},
    )
    assert refused.status_code == 409
    assert "not owned" in refused.json()["detail"]


def test_disconnect_and_revoke(client: TestClient) -> None:
    provider = FakeGoogleProvider()
    connect(client, provider)
    revoked = client.post("/api/v1/calendar/revoke")
    assert revoked.status_code == 200
    assert revoked.json()["status"] == "revoked"
    assert provider.revoked is True
    assert client.get("/api/v1/calendar/status").json()["connected"] is False


def test_revoke_always_deletes_local_credentials_when_google_fails(client: TestClient) -> None:
    class RevokeFailureProvider(FakeGoogleProvider):
        def revoke(self, token: str) -> None:
            raise GoogleProviderError("provider_unavailable", "Google is unavailable", 503)

    provider = RevokeFailureProvider()
    connect(client, provider)

    revoked = client.post("/api/v1/calendar/revoke")

    assert revoked.status_code == 200
    assert revoked.json()["status"] == "disconnected_with_warning"
    assert client.get("/api/v1/calendar/status").json()["connected"] is False


def test_provider_errors_are_actionable(client: TestClient) -> None:
    class FailingProvider(FakeGoogleProvider):
        def list_calendars(self, access_token: str) -> list[dict[str, object]]:
            raise GoogleProviderError(
                "rate_limited", "Google rate-limited the request. Wait briefly and retry.", 429
            )

    provider = FailingProvider()
    connect(client, provider)
    response = client.get("/api/v1/calendar/calendars")
    assert response.status_code == 429
    assert "retry" in response.json()["detail"].lower()


def test_study_calendar_selection_requires_write_access(client: TestClient) -> None:
    provider = FakeGoogleProvider()
    connect(client, provider)

    response = client.patch(
        "/api/v1/calendar/preferences",
        json={"study_calendar_id": "school", "busy_calendar_ids": ["school"]},
    )

    assert response.status_code == 422


def test_existing_publication_stays_bound_to_its_original_calendar(client: TestClient) -> None:
    provider = FakeGoogleProvider()
    connect(client, provider)
    assert client.post("/api/v1/calendar/study-calendar", json={}).status_code == 200
    preview = client.get("/api/v1/calendar/study-sessions/session-seminar-1/preview")
    confirmation = {"confirmation_token": preview.json()["confirmation_token"]}
    assert (
        client.post(
            "/api/v1/calendar/study-sessions/session-seminar-1/publish", json=confirmation
        ).status_code
        == 200
    )
    assert (
        client.patch(
            "/api/v1/calendar/preferences",
            json={"study_calendar_id": "primary", "busy_calendar_ids": ["primary"]},
        ).status_code
        == 200
    )

    republished = client.post(
        "/api/v1/calendar/study-sessions/session-seminar-1/publish", json=confirmation
    )

    assert republished.status_code == 200
    assert provider.last_read_calendar_id == "study-calendar"


def test_publish_recovers_from_a_concurrent_deterministic_insert(client: TestClient) -> None:
    class ConcurrentInsertProvider(FakeGoogleProvider):
        def insert_event(
            self, access_token: str, calendar_id: str, payload: dict[str, object]
        ) -> dict[str, object]:
            event_id = str(payload["id"])
            self.events[event_id] = {**payload, "id": event_id, "etag": "etag-concurrent"}
            raise GoogleProviderError("provider_conflict", "Event already exists", 409)

    provider = ConcurrentInsertProvider()
    connect(client, provider)
    assert client.post("/api/v1/calendar/study-calendar", json={}).status_code == 200
    preview = client.get("/api/v1/calendar/study-sessions/session-seminar-1/preview").json()

    published = client.post(
        "/api/v1/calendar/study-sessions/session-seminar-1/publish",
        json={"confirmation_token": preview["confirmation_token"]},
    )

    assert published.status_code == 200
    assert published.json()["provider_event_id"].startswith("cs")


def test_oauth_tokens_are_encrypted_at_rest() -> None:
    cipher = CredentialCipher(TEST_ENCRYPTION_KEY)

    encrypted = cipher.encrypt("refresh-secret")

    assert encrypted != "refresh-secret"
    assert "refresh-secret" not in encrypted
    assert cipher.decrypt(encrypted) == "refresh-secret"


def test_credential_cipher_supports_versioned_key_rotation() -> None:
    old_key = Fernet.generate_key().decode("ascii")
    new_key = Fernet.generate_key().decode("ascii")
    old_cipher = CredentialCipher(old_key, current_version=1)
    rotating_cipher = CredentialCipher(new_key, current_version=2, previous_keys={1: old_key})

    encrypted_with_old_key = old_cipher.encrypt("refresh-secret")

    assert rotating_cipher.current_version == 2
    assert rotating_cipher.decrypt(encrypted_with_old_key, key_version=1) == "refresh-secret"


def test_busy_sync_rejects_naive_and_excessive_ranges(client: TestClient) -> None:
    naive = client.post(
        "/api/v1/calendar/sync-busy",
        json={"time_min": "2026-09-16T08:00:00", "time_max": "2026-09-17T08:00:00"},
    )
    excessive = client.post(
        "/api/v1/calendar/sync-busy",
        json={
            "time_min": "2026-01-01T00:00:00Z",
            "time_max": "2026-12-31T00:00:00Z",
        },
    )

    assert naive.status_code == 422
    assert excessive.status_code == 422
