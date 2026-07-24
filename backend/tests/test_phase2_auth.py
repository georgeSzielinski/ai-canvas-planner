from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.auth_routes import get_google_provider
from app.core.config import get_settings
from app.db.session import get_db
from app.main import app
from app.models import UserProfile
from tests.test_phase2_calendar import TEST_SETTINGS, FakeGoogleProvider


def test_anonymous_session_status(anonymous_client: TestClient) -> None:
    response = anonymous_client.get("/api/v1/auth/session")

    assert response.status_code == 200
    assert response.json() == {
        "authenticated": False,
        "expires_at": None,
        "csrf_token": None,
        "reauthentication_required": False,
    }


def test_workspace_api_requires_authentication(anonymous_client: TestClient) -> None:
    response = anonymous_client.get("/api/v1/settings")

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"
    assert response.json()["error"] == {
        "code": "authentication_required",
        "message": "Authentication required",
    }


def test_invalid_session_cookie_is_treated_as_expired(anonymous_client: TestClient) -> None:
    anonymous_client.cookies.set("canvas_sweeper_session", "not-a-real-session")

    response = anonymous_client.get("/api/v1/user/profile")

    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_profile_settings_persist_for_authenticated_user(client: TestClient) -> None:
    update = client.patch(
        "/api/v1/user/profile",
        json={
            "display_name": "Maya Updated",
            "timezone": "America/New_York",
            "preferred_theme": "dark",
            "school_year": "Senior",
            "week_starts_on": "sunday",
        },
    )

    assert update.status_code == 200
    profile = client.get("/api/v1/user/profile")
    assert profile.status_code == 200
    body = profile.json()
    assert body["display_name"] == "Maya Updated"
    assert body["timezone"] == "America/New_York"
    assert body["preferred_theme"] == "dark"
    assert body["school_year"] == "Senior"
    assert body["week_starts_on"] == "sunday"


def test_profile_and_onboarding_reject_invalid_timezone_and_times(client: TestClient) -> None:
    invalid_timezone = client.patch(
        "/api/v1/user/profile",
        json={"timezone": "Not/A-Timezone"},
    )
    assert invalid_timezone.status_code == 422

    invalid_clock = client.put(
        "/api/v1/user/onboarding",
        json={
            "school_year": "Junior",
            "timezone": "America/Los_Angeles",
            "week_starts_on": "monday",
            "bedtime": "25:00",
            "wake_time": "06:30",
            "rowing_schedule": [],
            "default_study_duration": 45,
            "preferred_calendar": None,
            "calendar_consent": False,
        },
    )
    assert invalid_clock.status_code == 422


def test_calendar_consent_can_be_enabled_after_onboarding(client: TestClient) -> None:
    update = client.patch("/api/v1/user/profile", json={"calendar_consent": True})

    assert update.status_code == 200
    assert update.json()["calendar_consent"] is True
    assert client.get("/api/v1/user/profile").json()["calendar_consent"] is True


def test_google_login_persists_and_logout_revokes_session(
    anonymous_client: TestClient,
) -> None:
    provider = FakeGoogleProvider()
    app.dependency_overrides[get_settings] = lambda: TEST_SETTINGS
    app.dependency_overrides[get_google_provider] = lambda: provider

    start = anonymous_client.get("/api/v1/auth/google/start", follow_redirects=False)
    assert start.status_code == 302
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    callback = anonymous_client.get(
        "/api/v1/auth/google/callback",
        params={"state": state, "code": "calendar-code"},
        follow_redirects=False,
    )
    assert callback.status_code == 302
    assert callback.headers["location"].endswith("/overview")
    session = anonymous_client.get("/api/v1/auth/session")
    assert session.status_code == 200
    assert session.json()["authenticated"] is True

    csrf = anonymous_client.cookies.get("canvas_sweeper_csrf")
    logged_out = anonymous_client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf or ""})
    assert logged_out.status_code == 200
    assert anonymous_client.get("/api/v1/auth/session").json()["authenticated"] is False


def test_google_login_preserves_only_safe_workspace_destinations(
    anonymous_client: TestClient,
) -> None:
    app.dependency_overrides[get_settings] = lambda: TEST_SETTINGS
    app.dependency_overrides[get_google_provider] = lambda: FakeGoogleProvider()

    safe_start = anonymous_client.get(
        "/api/v1/auth/google/start",
        params={"next": "/assignments?course=physics"},
        follow_redirects=False,
    )
    safe_state = parse_qs(urlparse(safe_start.headers["location"]).query)["state"][0]
    safe_callback = anonymous_client.get(
        "/api/v1/auth/google/callback",
        params={"state": safe_state, "code": "calendar-code"},
        follow_redirects=False,
    )
    assert safe_callback.headers["location"].endswith("/assignments?course=physics")

    unsafe_start = anonymous_client.get(
        "/api/v1/auth/google/start",
        params={"next": "//evil.example/path"},
        follow_redirects=False,
    )
    unsafe_state = parse_qs(urlparse(unsafe_start.headers["location"]).query)["state"][0]
    unsafe_callback = anonymous_client.get(
        "/api/v1/auth/google/callback",
        params={"state": unsafe_state, "code": "calendar-code"},
        follow_redirects=False,
    )
    assert unsafe_callback.headers["location"].endswith("/overview")


def test_first_google_login_initializes_an_isolated_workspace(
    anonymous_client: TestClient,
) -> None:
    class NewUserProvider(FakeGoogleProvider):
        def userinfo(self, access_token: str) -> dict[str, object]:
            return {
                "sub": "google-new-student",
                "email": "new-student@example.test",
                "email_verified": True,
                "name": "New Student",
            }

    app.dependency_overrides[get_settings] = lambda: TEST_SETTINGS
    app.dependency_overrides[get_google_provider] = lambda: NewUserProvider()
    start = anonymous_client.get("/api/v1/auth/google/start", follow_redirects=False)
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    callback = anonymous_client.get(
        "/api/v1/auth/google/callback",
        params={"state": state, "code": "calendar-code"},
        follow_redirects=False,
    )

    assert callback.status_code == 302
    bootstrap = anonymous_client.get("/api/v1/workspace/bootstrap")
    assert bootstrap.status_code == 200
    assert bootstrap.json()["courses"] == []
    assert bootstrap.json()["assignments"] == []
    assert bootstrap.json()["sessions"] == []
    assert bootstrap.json()["routine"] == []
    assert bootstrap.json()["notifications"] == []
    assert bootstrap.json()["workload"] == []


def test_google_login_state_is_bound_to_the_starting_browser(
    anonymous_client: TestClient,
) -> None:
    provider = FakeGoogleProvider()
    app.dependency_overrides[get_settings] = lambda: TEST_SETTINGS
    app.dependency_overrides[get_google_provider] = lambda: provider

    start = anonymous_client.get("/api/v1/auth/google/start", follow_redirects=False)
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    assert anonymous_client.cookies.get("canvas_sweeper_oauth_binding")

    with TestClient(app) as other_browser:
        callback = other_browser.get(
            "/api/v1/auth/google/callback",
            params={"state": state, "code": "attacker-code"},
            follow_redirects=False,
        )

    assert callback.status_code == 400


def test_google_login_refuses_to_rebind_an_existing_google_account(
    anonymous_client: TestClient,
) -> None:
    provider = FakeGoogleProvider()
    app.dependency_overrides[get_settings] = lambda: TEST_SETTINGS
    app.dependency_overrides[get_google_provider] = lambda: provider
    database_dependency = app.dependency_overrides[get_db]
    database_generator = database_dependency()
    database = next(database_generator)
    user = database.scalar(select(UserProfile).where(UserProfile.id == "user-demo"))
    assert user
    user.google_id = "different-google-subject"
    database.commit()
    database_generator.close()

    start = anonymous_client.get("/api/v1/auth/google/start", follow_redirects=False)
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    callback = anonymous_client.get(
        "/api/v1/auth/google/callback",
        params={"state": state, "code": "calendar-code"},
        follow_redirects=False,
    )

    assert callback.status_code == 409
