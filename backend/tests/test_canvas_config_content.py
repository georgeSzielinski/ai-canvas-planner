import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.services.canvas_content import (
    classify_assignment,
    sanitize_canvas_html,
    validate_canvas_url,
)


def test_canvas_base_url_is_normalized() -> None:
    settings = Settings(
        canvas_base_url="https://sequoia.instructure.com/",
        canvas_access_token="value",
    )
    assert settings.canvas_base_url == "https://sequoia.instructure.com"


def test_production_canvas_url_requires_https() -> None:
    with pytest.raises(ValidationError):
        Settings(
            environment="production",
            canvas_base_url="http://sequoia.instructure.com",
            canvas_access_token="value",
            google_client_id="id",
            google_client_secret="secret",
            oauth_state_secret="x" * 32,
            credential_encryption_key="gAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            frontend_url="https://app.example",
            google_auth_redirect_uri="https://app.example/auth",
            google_calendar_redirect_uri="https://app.example/calendar",
            cors_origins="https://app.example",
        )


def test_environment_canvas_token_is_rejected_outside_local_development() -> None:
    with pytest.raises(ValidationError) as raised:
        Settings(
            environment="production",
            canvas_base_url="https://sequoia.instructure.com",
            canvas_access_token="value",
            google_client_id="id",
            google_client_secret="secret",
            oauth_state_secret="x" * 32,
            credential_encryption_key="gAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            frontend_url="https://app.example",
            google_auth_redirect_uri="https://app.example/auth",
            google_calendar_redirect_uri="https://app.example/calendar",
            cors_origins="https://app.example",
        )
    assert "development-only" in str(raised.value)


def test_local_http_canvas_fixture_is_allowed_only_on_loopback() -> None:
    assert (
        Settings(canvas_base_url="http://127.0.0.1:9000/").canvas_base_url
        == "http://127.0.0.1:9000"
    )
    with pytest.raises(ValidationError):
        Settings(canvas_base_url="http://canvas.example")


def test_canvas_tuning_settings_have_positive_bounds() -> None:
    with pytest.raises(ValidationError):
        Settings(canvas_request_timeout_seconds=0)
    with pytest.raises(ValidationError):
        Settings(canvas_max_pages=0)
    with pytest.raises(ValidationError):
        Settings(canvas_max_records=0)


def test_sanitizes_canvas_html_to_plain_text() -> None:
    value = sanitize_canvas_html(
        '<p>Read <strong>chapter 2</strong>.</p><script>alert("secret")</script><a href="javascript:bad">link</a>'
    )
    assert value == "Read chapter 2. link"
    assert "script" not in value
    assert "alert" not in value
    assert "javascript" not in value


def test_validates_assignment_url_against_canvas_origin() -> None:
    base = "https://sequoia.instructure.com"
    assert (
        validate_canvas_url("https://sequoia.instructure.com/courses/2/assignments/4", base)
        == "https://sequoia.instructure.com/courses/2/assignments/4"
    )
    assert validate_canvas_url("https://evil.example/steal", base) is None
    assert validate_canvas_url("javascript:alert(1)", base) is None


@pytest.mark.parametrize(
    ("name", "group", "submission_types", "expected", "reason_fragment"),
    [
        ("Unit 3 Midterm Exam", None, [], "test", "exam"),
        ("Chapter 4 Quiz", None, ["online_quiz"], "quiz", "quiz"),
        ("Literary analysis essay", None, ["online_text_entry"], "essay", "essay"),
        ("Capstone Project", None, [], "project", "project"),
        ("Read chapters 8-9", None, [], "reading", "read"),
        ("Week 2 Discussion", None, ["discussion_topic"], "discussion", "discussion"),
        ("Problem Set 6", None, [], "worksheet", "problem set"),
        ("Final Presentation", None, [], "presentation", "presentation"),
        ("Chemistry Lab Report", None, [], "lab", "lab"),
        ("Module reflection", None, [], "other", "no deterministic"),
    ],
)
def test_deterministic_assignment_classification(
    name: str,
    group: str | None,
    submission_types: list[str],
    expected: str,
    reason_fragment: str,
) -> None:
    result = classify_assignment(name, group, submission_types)
    assert result.category == expected
    assert reason_fragment in result.reason.lower()
