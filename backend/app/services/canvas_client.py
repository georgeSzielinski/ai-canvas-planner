import asyncio
import zlib
from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Any, Protocol, Self, TypeVar
from urllib.parse import urlsplit

import httpx
from pydantic import BaseModel, ConfigDict, Field, SecretStr, ValidationError

from app.core.config import Settings

ModelT = TypeVar("ModelT", bound=BaseModel)


class CanvasProviderError(RuntimeError):
    def __init__(self, code: str, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class CanvasCredentials(BaseModel):
    model_config = ConfigDict(frozen=True)

    base_url: str
    access_token: SecretStr


class CanvasCredentialProvider(Protocol):
    def configured(self) -> bool: ...

    def for_user(self, user_id: str) -> CanvasCredentials | None: ...


class EnvironmentCanvasCredentialProvider:
    """Local-development provider; the shared environment token is never persisted."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def configured(self) -> bool:
        return bool(
            self.settings.canvas_base_url
            and self.settings.canvas_access_token.get_secret_value().strip()
        )

    def for_user(self, user_id: str) -> CanvasCredentials | None:
        del user_id
        if not self.configured():
            return None
        return CanvasCredentials(
            base_url=self.settings.canvas_base_url,
            access_token=SecretStr(self.settings.canvas_access_token.get_secret_value().strip()),
        )


class CanvasIdentity(BaseModel):
    id: int
    display_name: str = Field(alias="name", min_length=1, max_length=255)
    short_name: str | None = Field(default=None, max_length=255)


class CanvasTermPayload(BaseModel):
    id: int | None = None
    name: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None


class CanvasCoursePayload(BaseModel):
    id: int
    name: str | None = None
    course_code: str | None = None
    enrollment_state: str | None = None
    workflow_state: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    is_favorite: bool | None = None
    term: CanvasTermPayload | None = None


class CanvasSubmissionPayload(BaseModel):
    workflow_state: str | None = None
    submitted_at: datetime | None = None
    graded_at: datetime | None = None
    score: float | None = None
    grade: str | None = None
    late: bool = False
    missing: bool = False
    excused: bool = False
    attempt: int | None = None
    seconds_late: int | None = None
    updated_at: datetime | None = None


class CanvasAssignmentPayload(BaseModel):
    id: int
    course_id: int
    name: str = Field(min_length=1, max_length=1000)
    description: str | None = None
    html_url: str | None = None
    due_at: datetime | None = None
    unlock_at: datetime | None = None
    lock_at: datetime | None = None
    points_possible: float | None = None
    submission_types: list[str] = Field(default_factory=list)
    assignment_group_id: int | None = None
    grading_type: str | None = None
    published: bool = True
    omit_from_final_grade: bool = False
    peer_reviews: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None
    submission: CanvasSubmissionPayload | None = None


Sleep = Callable[[float], Awaitable[None]]


class CanvasApiClient:
    def __init__(
        self,
        settings: Settings,
        *,
        credentials: CanvasCredentials | None = None,
        http_client: httpx.AsyncClient | None = None,
        sleep: Sleep = asyncio.sleep,
    ) -> None:
        resolved = credentials or EnvironmentCanvasCredentialProvider(settings).for_user(
            "environment"
        )
        if resolved is None:
            raise CanvasProviderError(
                "not_configured",
                "Canvas is not configured. Add the Canvas base URL and access token to the server environment.",
                503,
            )
        self.settings = settings
        self.credentials = resolved
        self._origin = self._origin_for(resolved.base_url)
        self._sleep = sleep
        self._owns_client = http_client is None
        self._client = http_client or httpx.AsyncClient(
            timeout=httpx.Timeout(settings.canvas_request_timeout_seconds),
            follow_redirects=False,
        )

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *_args: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def verify(self) -> CanvasIdentity:
        payload = await self._get_object("/api/v1/users/self/profile")
        return self._validate(CanvasIdentity, payload)

    async def list_courses(self, *, include_concluded: bool) -> list[CanvasCoursePayload]:
        states = ["active"]
        if include_concluded:
            states.extend(["completed", "invited"])
        params: list[tuple[str, str]] = [
            ("per_page", str(self.settings.canvas_page_size)),
            ("include[]", "term"),
            ("include[]", "total_students"),
        ]
        params.extend(("enrollment_state[]", state) for state in states)
        payloads = await self._get_pages("/api/v1/courses", params=params)
        return [self._validate(CanvasCoursePayload, item) for item in payloads]

    async def list_assignments(self, course_id: int) -> list[CanvasAssignmentPayload]:
        payloads = await self._get_pages(
            f"/api/v1/courses/{course_id}/assignments",
            params=[
                ("per_page", str(self.settings.canvas_page_size)),
                ("include[]", "submission"),
            ],
        )
        assignments = [self._validate(CanvasAssignmentPayload, item) for item in payloads]
        return [
            assignment.model_copy(update={"html_url": self._safe_resource_url(assignment.html_url)})
            for assignment in assignments
        ]

    async def _get_object(self, path: str) -> dict[str, Any]:
        response = await self._request("GET", self._url(path))
        payload = self._json(response)
        if not isinstance(payload, dict):
            raise self._malformed()
        return payload

    async def _get_pages(
        self,
        path: str,
        *,
        params: list[tuple[str, str]] | None = None,
    ) -> list[dict[str, Any]]:
        url = self._url(path)
        next_params = params
        records: list[dict[str, Any]] = []
        for page_number in range(1, self.settings.canvas_max_pages + 1):
            response = await self._request("GET", url, params=next_params)
            payload = self._json(response)
            if not isinstance(payload, list) or any(not isinstance(item, dict) for item in payload):
                raise self._malformed()
            records.extend(payload)
            if len(records) > self.settings.canvas_max_records:
                raise CanvasProviderError(
                    "record_limit",
                    "Canvas returned more records than the configured synchronization safety limit.",
                    502,
                )
            next_link = response.links.get("next", {}).get("url")
            if not next_link:
                return records
            url = self._safe_pagination_url(str(next_link))
            next_params = None
            if page_number == self.settings.canvas_max_pages:
                break
        raise CanvasProviderError(
            "pagination_limit",
            "Canvas pagination exceeded the configured synchronization safety limit.",
            502,
        )

    async def _request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        headers = dict(kwargs.pop("headers", {}))
        headers.update(
            {
                "Authorization": f"Bearer {self.credentials.access_token.get_secret_value()}",
                "Accept": "application/json",
                "Accept-Encoding": "gzip, identity",
                "User-Agent": "Canvas-Sweeper/0.2",
            }
        )
        attempts = self.settings.canvas_retry_attempts if method.upper() in {"GET", "HEAD"} else 1
        for attempt in range(attempts):
            try:
                async with self._client.stream(method, url, headers=headers, **kwargs) as streamed:
                    if streamed.status_code in {429, 500, 502, 503, 504} and attempt + 1 < attempts:
                        await self._sleep(self._retry_delay(streamed, attempt))
                        continue
                    self._raise_for_status(streamed)
                    content_length = streamed.headers.get("Content-Length")
                    if content_length:
                        try:
                            if int(content_length) > self.settings.canvas_max_response_bytes:
                                raise self._response_too_large()
                        except ValueError:
                            pass
                    content = await self._read_response_content(streamed)
                    decoded_headers = {
                        name: value
                        for name, value in streamed.headers.items()
                        if name.lower()
                        not in {"content-encoding", "content-length", "transfer-encoding"}
                    }
                    response = httpx.Response(
                        streamed.status_code,
                        headers=decoded_headers,
                        content=content,
                        request=streamed.request,
                    )
            except httpx.TimeoutException as error:
                if attempt + 1 < attempts:
                    await self._sleep(min(0.25 * (2**attempt), 2.0))
                    continue
                raise CanvasProviderError(
                    "network_timeout", "Canvas did not respond before the request timed out.", 503
                ) from error
            except httpx.NetworkError as error:
                if attempt + 1 < attempts:
                    await self._sleep(min(0.25 * (2**attempt), 2.0))
                    continue
                raise CanvasProviderError(
                    "canvas_unavailable", "Canvas could not be reached. Try again later.", 503
                ) from error
            return response
        raise CanvasProviderError("canvas_unavailable", "Canvas could not be reached.", 503)

    async def _read_response_content(self, response: httpx.Response) -> bytes:
        if response.is_stream_consumed:
            if len(response.content) > self.settings.canvas_max_response_bytes:
                raise self._response_too_large()
            return response.content

        encoding = response.headers.get("Content-Encoding", "").strip().lower()
        if encoding in {"", "identity"}:
            decoder: Any | None = None
        elif encoding == "gzip":
            decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
        else:
            raise CanvasProviderError(
                "unsupported_content_encoding",
                "Canvas returned a response with an unsupported content encoding.",
                502,
            )

        content = bytearray()

        def consume(raw_chunk: bytes) -> None:
            pending = raw_chunk
            while pending:
                remaining = self.settings.canvas_max_response_bytes - len(content)
                if decoder is None:
                    if len(pending) > remaining:
                        raise self._response_too_large()
                    content.extend(pending)
                    break
                decoded = decoder.decompress(pending, remaining + 1)
                if len(decoded) > remaining:
                    raise self._response_too_large()
                content.extend(decoded)
                pending = decoder.unconsumed_tail

        try:
            async for raw_chunk in response.aiter_raw(chunk_size=65_536):
                consume(raw_chunk)
            if decoder is not None:
                remaining = self.settings.canvas_max_response_bytes - len(content)
                decoded = decoder.flush(max(remaining + 1, 1))
                if len(decoded) > remaining:
                    raise self._response_too_large()
                content.extend(decoded)
                if not decoder.eof or decoder.unused_data:
                    raise self._malformed()
        except zlib.error as error:
            raise self._malformed() from error
        return bytes(content)

    @staticmethod
    def _retry_delay(response: httpx.Response, attempt: int) -> float:
        retry_after = response.headers.get("Retry-After", "")
        try:
            return min(max(float(retry_after), 0.0), 5.0)
        except ValueError:
            return float(min(0.25 * (2**attempt), 2.0))

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        status = response.status_code
        if status == 401:
            raise CanvasProviderError(
                "invalid_token",
                "The Canvas credential is invalid or expired. Replace it and retry.",
                401,
            )
        if status == 403:
            raise CanvasProviderError(
                "permission_denied", "Canvas denied access to the requested resource.", 403
            )
        if status == 404:
            raise CanvasProviderError(
                "resource_unavailable", "The requested Canvas resource is unavailable.", 404
            )
        if status == 429:
            raise CanvasProviderError(
                "rate_limited", "Canvas rate-limited the request. Wait briefly and retry.", 429
            )
        if status >= 500:
            raise CanvasProviderError(
                "canvas_unavailable", "Canvas is temporarily unavailable. Try again later.", 503
            )
        if response.is_error:
            raise CanvasProviderError("canvas_rejected", "Canvas rejected the request.", 502)

    @staticmethod
    def _json(response: httpx.Response) -> object:
        try:
            return response.json()
        except ValueError as error:
            raise CanvasApiClient._malformed() from error

    @staticmethod
    def _malformed() -> CanvasProviderError:
        return CanvasProviderError(
            "malformed_response", "Canvas returned a response that could not be validated.", 502
        )

    @staticmethod
    def _response_too_large() -> CanvasProviderError:
        return CanvasProviderError(
            "response_too_large",
            "Canvas returned a response larger than the configured safety limit.",
            502,
        )

    @staticmethod
    def _validate(model: type[ModelT], payload: dict[str, Any]) -> ModelT:
        try:
            return model.model_validate(payload)
        except ValidationError as error:
            raise CanvasApiClient._malformed() from error

    def _url(self, path: str) -> str:
        return f"{self.credentials.base_url.rstrip('/')}/{path.lstrip('/')}"

    @staticmethod
    def _origin_for(url: str) -> tuple[str, str, int | None]:
        parsed = urlsplit(url)
        return parsed.scheme, parsed.hostname or "", parsed.port

    def _safe_pagination_url(self, url: str) -> str:
        parsed = urlsplit(url)
        if parsed.username or parsed.password or self._origin_for(url) != self._origin:
            raise CanvasProviderError(
                "unsafe_pagination_link",
                "Canvas returned a pagination link outside the configured institution.",
                502,
            )
        return url

    def _safe_resource_url(self, url: str | None) -> str | None:
        if not url:
            return None
        parsed = urlsplit(url)
        candidate = self._url(url) if not parsed.scheme and not parsed.netloc else url
        parsed = urlsplit(candidate)
        if parsed.username or parsed.password or self._origin_for(candidate) != self._origin:
            return None
        return candidate
