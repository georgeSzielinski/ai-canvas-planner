from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Barrier

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.base import Base
from app.models import OAuthState, OAuthStateLock
from app.services.auth import (
    MAX_ACTIVE_OAUTH_STATES,
    MAX_OAUTH_STATES_PER_REQUESTER,
    OAuthStateSigner,
    create_oauth_state,
)
from app.services.google import GoogleProvider


def test_oauth_state_creation_removes_expired_and_consumed_rows() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as setup:
        setup.add(OAuthStateLock(id=1))
        setup.commit()
    now = datetime.now(UTC)
    with Session(engine) as database:
        database.add_all(
            [
                OAuthState(
                    id="expired",
                    action="identity",
                    requester_hash="expired-requester",
                    expires_at=now - timedelta(seconds=1),
                ),
                OAuthState(
                    id="consumed",
                    action="identity",
                    requester_hash="consumed-requester",
                    expires_at=now + timedelta(minutes=5),
                    consumed_at=now,
                ),
            ]
        )
        database.commit()

        create_oauth_state(database, OAuthStateSigner("x" * 32), "identity")

        ids = set(database.scalars(select(OAuthState.id)))
        assert "expired" not in ids
        assert "consumed" not in ids
        assert len(ids) == 1


def test_one_oauth_requester_cannot_exhaust_capacity_for_other_clients() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as setup:
        setup.add(OAuthStateLock(id=1))
        setup.commit()
    signer = OAuthStateSigner("x" * 32)
    with Session(engine) as database:
        for _ in range(MAX_OAUTH_STATES_PER_REQUESTER):
            create_oauth_state(database, signer, "identity", requester_key="client-a")

        with pytest.raises(HTTPException) as error:
            create_oauth_state(database, signer, "identity", requester_key="client-a")

        assert error.value.status_code == 429
        create_oauth_state(database, signer, "identity", requester_key="client-b")


def test_oauth_state_storage_stays_bounded_without_globally_rejecting_new_clients() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as setup:
        setup.add(OAuthStateLock(id=1))
        setup.commit()
    now = datetime.now(UTC)
    with Session(engine) as database:
        database.add_all(
            [
                OAuthState(
                    id=f"active-{index}",
                    action="identity",
                    requester_hash=f"requester-{index}",
                    expires_at=now + timedelta(minutes=5),
                )
                for index in range(MAX_ACTIVE_OAUTH_STATES)
            ]
        )
        database.commit()

        create_oauth_state(
            database,
            OAuthStateSigner("x" * 32),
            "identity",
            requester_key="new-client",
        )

        assert (
            database.scalar(select(func.count()).select_from(OAuthState)) == MAX_ACTIVE_OAUTH_STATES
        )


def test_oauth_requester_limit_is_atomic_across_sessions(tmp_path: Path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'oauth-concurrency.sqlite3'}",
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    Base.metadata.create_all(engine)
    signer = OAuthStateSigner("x" * 32)
    with Session(engine) as database:
        database.add(OAuthStateLock(id=1))
        database.commit()
        for _ in range(MAX_OAUTH_STATES_PER_REQUESTER - 1):
            create_oauth_state(database, signer, "identity", requester_key="shared-client")

    barrier = Barrier(2)

    def create_concurrently() -> str:
        with Session(engine) as database:
            barrier.wait()
            try:
                create_oauth_state(database, signer, "identity", requester_key="shared-client")
            except HTTPException as error:
                return str(error.status_code)
            return "created"

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = sorted(pool.map(lambda _: create_concurrently(), range(2)))

    assert outcomes == ["429", "created"]
    with Session(engine) as database:
        assert (
            database.scalar(select(func.count()).select_from(OAuthState))
            == MAX_OAUTH_STATES_PER_REQUESTER
        )


def test_google_provider_encodes_calendar_and_event_path_segments() -> None:
    urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        urls.append(str(request.url))
        if request.method == "GET" and request.url.path.endswith("/events"):
            return httpx.Response(200, json={"items": []})
        return httpx.Response(200, json={})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = GoogleProvider(Settings(), client)
    calendar_id = "holidays#calendar/id @group"
    event_id = "event#one/two"

    list(provider.list_events("token", calendar_id, "2026-01-01", "2026-01-02"))
    provider.get_event("token", calendar_id, event_id)
    provider.insert_event("token", calendar_id, {})
    provider.update_event("token", calendar_id, event_id, {})

    encoded_calendar = "holidays%23calendar%2Fid%20%40group"
    encoded_event = "event%23one%2Ftwo"
    assert urls == [
        f"https://www.googleapis.com/calendar/v3/calendars/{encoded_calendar}/events?timeMin=2026-01-01&timeMax=2026-01-02&singleEvents=true&showDeleted=false&maxResults=2500&orderBy=startTime",
        f"https://www.googleapis.com/calendar/v3/calendars/{encoded_calendar}/events/{encoded_event}",
        f"https://www.googleapis.com/calendar/v3/calendars/{encoded_calendar}/events",
        f"https://www.googleapis.com/calendar/v3/calendars/{encoded_calendar}/events/{encoded_event}",
    ]
