from collections.abc import Iterator
from typing import Any
from urllib.parse import quote, urlencode

import httpx

from app.core.config import Settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
IDENTITY_SCOPES = ["openid", "email", "profile"]
CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.calendars",
]


def path_segment(value: str) -> str:
    return quote(value, safe="")


class GoogleProviderError(RuntimeError):
    def __init__(self, code: str, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class GoogleProvider:
    def __init__(self, settings: Settings, client: httpx.Client | None = None) -> None:
        self.settings = settings
        self.client = client or httpx.Client(timeout=15.0)

    def configured(self) -> bool:
        return bool(self.settings.google_client_id and self.settings.google_client_secret)

    def authorization_url(
        self,
        *,
        state: str,
        redirect_uri: str,
        scopes: list[str],
        prompt: str | None = None,
    ) -> str:
        params = {
            "client_id": self.settings.google_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(scopes),
            "state": state,
            "access_type": "offline",
            "include_granted_scopes": "true",
        }
        if prompt:
            params["prompt"] = prompt
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: str) -> dict[str, Any]:
        response = self._request(
            "POST",
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": self.settings.google_client_id,
                "client_secret": self.settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        return self._json(response)

    def refresh_token(self, refresh_token: str) -> dict[str, Any]:
        response = self._request(
            "POST",
            GOOGLE_TOKEN_URL,
            data={
                "refresh_token": refresh_token,
                "client_id": self.settings.google_client_id,
                "client_secret": self.settings.google_client_secret,
                "grant_type": "refresh_token",
            },
        )
        return self._json(response)

    def userinfo(self, access_token: str) -> dict[str, Any]:
        return self._json(
            self._request(
                "GET",
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        )

    def list_calendars(self, access_token: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        page_token: str | None = None
        while True:
            params = {"maxResults": "250", "showDeleted": "false"}
            if page_token:
                params["pageToken"] = page_token
            payload = self._json(
                self._request(
                    "GET",
                    f"{GOOGLE_CALENDAR_API}/users/me/calendarList",
                    params=params,
                    headers=self._auth(access_token),
                )
            )
            items.extend(payload.get("items", []))
            page_token = payload.get("nextPageToken")
            if not page_token:
                return items

    def create_calendar(self, access_token: str, name: str, timezone: str) -> dict[str, Any]:
        calendar = self._json(
            self._request(
                "POST",
                f"{GOOGLE_CALENDAR_API}/calendars",
                headers=self._auth(access_token),
                json={"summary": name, "timeZone": timezone},
            )
        )
        calendar_id = calendar["id"]
        entry = self._json(
            self._request(
                "PATCH",
                f"{GOOGLE_CALENDAR_API}/users/me/calendarList/{path_segment(calendar_id)}",
                params={"colorRgbFormat": "true"},
                headers=self._auth(access_token),
                json={"backgroundColor": "#1d4ed8", "foregroundColor": "#ffffff"},
            )
        )
        return {**calendar, **entry}

    def list_events(
        self,
        access_token: str,
        calendar_id: str,
        time_min: str,
        time_max: str,
    ) -> Iterator[dict[str, Any]]:
        page_token: str | None = None
        while True:
            params = {
                "timeMin": time_min,
                "timeMax": time_max,
                "singleEvents": "true",
                "showDeleted": "false",
                "maxResults": "2500",
                "orderBy": "startTime",
            }
            if page_token:
                params["pageToken"] = page_token
            payload = self._json(
                self._request(
                    "GET",
                    f"{GOOGLE_CALENDAR_API}/calendars/{path_segment(calendar_id)}/events",
                    params=params,
                    headers=self._auth(access_token),
                )
            )
            yield from payload.get("items", [])
            page_token = payload.get("nextPageToken")
            if not page_token:
                return

    def get_event(self, access_token: str, calendar_id: str, event_id: str) -> dict[str, Any]:
        return self._json(
            self._request(
                "GET",
                f"{GOOGLE_CALENDAR_API}/calendars/{path_segment(calendar_id)}/events/{path_segment(event_id)}",
                headers=self._auth(access_token),
            )
        )

    def insert_event(
        self, access_token: str, calendar_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        return self._json(
            self._request(
                "POST",
                f"{GOOGLE_CALENDAR_API}/calendars/{path_segment(calendar_id)}/events",
                headers=self._auth(access_token),
                json=payload,
            )
        )

    def update_event(
        self,
        access_token: str,
        calendar_id: str,
        event_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        return self._json(
            self._request(
                "PATCH",
                f"{GOOGLE_CALENDAR_API}/calendars/{path_segment(calendar_id)}/events/{path_segment(event_id)}",
                headers=self._auth(access_token),
                json=payload,
            )
        )

    def revoke(self, token: str) -> None:
        self._request("POST", GOOGLE_REVOKE_URL, data={"token": token})

    @staticmethod
    def _auth(access_token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}

    def _request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        try:
            response = self.client.request(method, url, **kwargs)
        except (httpx.TimeoutException, httpx.NetworkError) as error:
            raise GoogleProviderError(
                "network_failure",
                "Google Calendar could not be reached. Check your connection and retry.",
                503,
            ) from error
        if response.status_code == 401:
            raise GoogleProviderError(
                "credentials_expired", "Google permissions expired. Reconnect your account.", 401
            )
        if response.status_code == 403:
            raise GoogleProviderError(
                "missing_permissions",
                "Google denied this calendar action. Reconnect and approve the requested permissions.",
                403,
            )
        if response.status_code == 404:
            raise GoogleProviderError(
                "calendar_unavailable", "The selected Google Calendar is no longer available.", 404
            )
        if response.status_code == 429:
            raise GoogleProviderError(
                "rate_limited", "Google rate-limited the request. Wait briefly and retry.", 429
            )
        if response.status_code >= 500:
            raise GoogleProviderError(
                "google_unavailable",
                "Google Calendar is temporarily unavailable. Retry later.",
                503,
            )
        if response.is_error:
            detail = self._json(response).get("error_description", "Google rejected the request.")
            raise GoogleProviderError("oauth_denied", str(detail), 400)
        return response

    @staticmethod
    def _json(response: httpx.Response) -> dict[str, Any]:
        try:
            payload = response.json()
        except ValueError as error:
            raise GoogleProviderError(
                "invalid_response", "Google returned an invalid response."
            ) from error
        if not isinstance(payload, dict):
            raise GoogleProviderError("invalid_response", "Google returned an invalid response.")
        return payload
