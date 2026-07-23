import asyncio
import gzip
import json
from datetime import UTC, datetime

import httpx
import pytest

from app.core.config import Settings
from app.services.canvas_client import (
    CanvasApiClient,
    CanvasAssignmentPayload,
    CanvasProviderError,
    EnvironmentCanvasCredentialProvider,
)


def test_canvas_payload_datetimes_are_aware_and_normalized_to_utc() -> None:
    payload = CanvasAssignmentPayload.model_validate(
        {
            "id": 1,
            "course_id": 2,
            "name": "Timezone test",
            "due_at": "2026-07-22T20:00:00Z",
            "unlock_at": "2026-07-22T13:00:00-07:00",
            "lock_at": None,
            "submission": {
                "submitted_at": "2026-07-22T12:30:00-07:00",
                "graded_at": None,
            },
        }
    )

    assert payload.due_at == datetime(2026, 7, 22, 20, 0, tzinfo=UTC)
    assert payload.unlock_at == datetime(2026, 7, 22, 20, 0, tzinfo=UTC)
    assert payload.lock_at is None
    assert payload.submission is not None
    assert payload.submission.submitted_at == datetime(2026, 7, 22, 19, 30, tzinfo=UTC)

    with pytest.raises(ValueError, match="timezone"):
        CanvasAssignmentPayload.model_validate(
            {"id": 1, "course_id": 2, "name": "Naive", "due_at": "2026-07-22T20:00:00"}
        )


def run(coro):  # type: ignore[no-untyped-def]
    return asyncio.run(coro)


def settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "canvas_base_url": "https://sequoia.instructure.com",
        "canvas_access_token": "test-token-never-log",
        "canvas_request_timeout_seconds": 1,
        "canvas_max_pages": 3,
        "canvas_max_records": 10,
        "canvas_retry_attempts": 2,
    }
    values.update(overrides)
    return Settings(**values)


def test_environment_credentials_are_configured_without_exposing_token() -> None:
    provider = EnvironmentCanvasCredentialProvider(settings())
    credentials = provider.for_user("user-1")

    assert provider.configured()
    assert credentials is not None
    assert credentials.base_url == "https://sequoia.instructure.com"
    assert credentials.access_token.get_secret_value() == "test-token-never-log"
    assert "test-token-never-log" not in repr(credentials)


def test_empty_environment_token_is_not_configured() -> None:
    provider = EnvironmentCanvasCredentialProvider(settings(canvas_access_token="   "))
    assert not provider.configured()
    assert provider.for_user("user-1") is None


def test_canvas_client_verifies_user_with_bearer_auth() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://sequoia.instructure.com/api/v1/users/self/profile"
        assert request.headers["Authorization"] == "Bearer test-token-never-log"
        return httpx.Response(
            200, json={"id": 42, "name": "Canvas Student", "short_name": "Student"}
        )

    transport = httpx.MockTransport(handler)
    async_client = httpx.AsyncClient(transport=transport)
    client = CanvasApiClient(settings(), http_client=async_client)
    identity = run(client.verify())
    run(async_client.aclose())

    assert identity.id == 42
    assert identity.display_name == "Canvas Student"


def test_canvas_client_keeps_only_same_origin_assignment_links() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=[
                {
                    "id": 1,
                    "course_id": 42,
                    "name": "Safe",
                    "html_url": "https://sequoia.instructure.com/courses/42/assignments/1",
                },
                {
                    "id": 2,
                    "course_id": 42,
                    "name": "Cross origin",
                    "html_url": "https://attacker.example/steal",
                },
                {
                    "id": 3,
                    "course_id": 42,
                    "name": "Unsafe scheme",
                    "html_url": "javascript:alert(1)",
                },
            ],
            request=request,
        )

    async_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = CanvasApiClient(settings(), http_client=async_client)

    assignments = asyncio.run(client.list_assignments(42))
    asyncio.run(async_client.aclose())

    assert assignments[0].html_url == "https://sequoia.instructure.com/courses/42/assignments/1"
    assert assignments[1].html_url is None
    assert assignments[2].html_url is None


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (401, "invalid_token"),
        (403, "permission_denied"),
        (429, "rate_limited"),
        (503, "canvas_unavailable"),
    ],
)
def test_canvas_client_maps_safe_provider_errors(status: int, code: str) -> None:
    transport = httpx.MockTransport(
        lambda _request: httpx.Response(status, text="secret provider body")
    )
    async_client = httpx.AsyncClient(transport=transport)
    client = CanvasApiClient(settings(), http_client=async_client)

    with pytest.raises(CanvasProviderError) as raised:
        run(client.verify())
    run(async_client.aclose())

    assert raised.value.code == code
    assert "secret provider body" not in str(raised.value)
    assert "test-token-never-log" not in str(raised.value)


def test_canvas_client_maps_timeout() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out with test-token-never-log")

    async_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = CanvasApiClient(settings(), http_client=async_client)
    with pytest.raises(CanvasProviderError) as raised:
        run(client.verify())
    run(async_client.aclose())
    assert raised.value.code == "network_timeout"
    assert "test-token-never-log" not in str(raised.value)


def test_canvas_client_rejects_malformed_payload() -> None:
    async_client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _request: httpx.Response(200, json={"name": "No id"}))
    )
    client = CanvasApiClient(settings(), http_client=async_client)
    with pytest.raises(CanvasProviderError) as raised:
        run(client.verify())
    run(async_client.aclose())
    assert raised.value.code == "malformed_response"


def test_canvas_client_follows_same_origin_link_pagination() -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        if request.url.params.get("page") == "2":
            return httpx.Response(200, json=[{"id": 2, "name": "Second"}])
        return httpx.Response(
            200,
            json=[{"id": 1, "name": "First"}],
            headers={
                "Link": '<https://sequoia.instructure.com/api/v1/courses?page=2&per_page=100>; rel="next"'
            },
        )

    async_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = CanvasApiClient(settings(), http_client=async_client)
    courses = run(client.list_courses(include_concluded=True))
    run(async_client.aclose())

    assert [course.id for course in courses] == [1, 2]
    assert len(calls) == 2


def test_canvas_client_rejects_hostile_pagination_url() -> None:
    response = httpx.Response(
        200,
        json=[{"id": 1, "name": "First"}],
        headers={"Link": '<https://evil.example/api/v1/courses?page=2>; rel="next"'},
    )
    async_client = httpx.AsyncClient(transport=httpx.MockTransport(lambda _request: response))
    client = CanvasApiClient(settings(), http_client=async_client)

    with pytest.raises(CanvasProviderError) as raised:
        run(client.list_courses(include_concluded=False))
    run(async_client.aclose())
    assert raised.value.code == "unsafe_pagination_link"


def test_canvas_client_rejects_pagination_url_with_userinfo() -> None:
    response = httpx.Response(
        200,
        json=[{"id": 1, "name": "First"}],
        headers={
            "Link": '<https://user:password@sequoia.instructure.com/api/v1/courses?page=2>; rel="next"'
        },
    )
    async_client = httpx.AsyncClient(transport=httpx.MockTransport(lambda _request: response))
    client = CanvasApiClient(settings(), http_client=async_client)

    with pytest.raises(CanvasProviderError) as raised:
        run(client.list_courses(include_concluded=False))
    run(async_client.aclose())
    assert raised.value.code == "unsafe_pagination_link"


def test_canvas_client_rejects_oversized_response_before_json_validation() -> None:
    body = b'{"id": 42, "name": "Canvas Student"}' + (b" " * 200)
    async_client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(
                200, content=body, headers={"Content-Type": "application/json"}
            )
        )
    )
    client = CanvasApiClient(
        settings(canvas_max_response_bytes=100),
        http_client=async_client,
    )

    with pytest.raises(CanvasProviderError) as raised:
        run(client.verify())
    run(async_client.aclose())
    assert raised.value.code == "response_too_large"


def test_canvas_client_decodes_compressed_response_once() -> None:
    body = gzip.compress(json.dumps({"id": 17, "name": "Compressed Student"}).encode())

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            stream=httpx.ByteStream(body),
            headers={"Content-Encoding": "gzip", "Content-Length": str(len(body))},
            request=request,
        )

    async_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = CanvasApiClient(settings(), http_client=async_client)
    identity = run(client.verify())
    run(async_client.aclose())

    assert identity.display_name == "Compressed Student"


def test_canvas_client_bounds_decoded_compressed_response() -> None:
    body = gzip.compress(json.dumps({"id": 17, "name": "A" * 10_000}).encode())
    assert len(body) < 200
    async_client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                stream=httpx.ByteStream(body),
                headers={"Content-Encoding": "gzip", "Content-Length": str(len(body))},
                request=request,
            )
        )
    )
    client = CanvasApiClient(settings(canvas_max_response_bytes=200), http_client=async_client)

    with pytest.raises(CanvasProviderError) as raised:
        run(client.verify())
    run(async_client.aclose())

    assert raised.value.code == "response_too_large"


def test_canvas_client_enforces_page_guard() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        page = int(request.url.params.get("page", "1"))
        return httpx.Response(
            200,
            json=[{"id": page, "name": f"Course {page}"}],
            headers={
                "Link": f'<https://sequoia.instructure.com/api/v1/courses?page={page + 1}>; rel="next"'
            },
        )

    limited = settings(canvas_max_pages=2)
    async_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = CanvasApiClient(limited, http_client=async_client)
    with pytest.raises(CanvasProviderError) as raised:
        run(client.list_courses(include_concluded=False))
    run(async_client.aclose())
    assert raised.value.code == "pagination_limit"


def test_canvas_client_retries_safe_transient_get_once() -> None:
    calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(503 if calls == 1 else 200, json={"id": 7, "name": "Recovered"})

    async def no_sleep(_seconds: float) -> None:
        return None

    async_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = CanvasApiClient(settings(), http_client=async_client, sleep=no_sleep)
    assert run(client.verify()).id == 7
    run(async_client.aclose())
    assert calls == 2
