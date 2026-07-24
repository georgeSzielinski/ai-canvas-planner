from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import AuthSession
from app.services.auth import hash_secret
from tests.fixtures.database_seed import seed_database


@pytest.fixture
def client(tmp_path: Path) -> Generator[TestClient, None, None]:
    database_path = tmp_path / "test.sqlite3"
    engine = create_engine(f"sqlite:///{database_path}", connect_args={"check_same_thread": False})
    testing_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    with testing_session() as database:
        seed_database(database)
        database.add(
            AuthSession(
                id="session-test",
                user_id="user-demo",
                token_hash=hash_secret("test-session-token"),
                csrf_token_hash=hash_secret("test-csrf-token"),
                expires_at=datetime.now(UTC) + timedelta(hours=1),
                last_seen_at=datetime.now(UTC),
                remember_login=True,
            )
        )
        database.commit()

    def override_database() -> Generator[Session, None, None]:
        with testing_session() as database:
            yield database

    app.dependency_overrides[get_db] = override_database
    with TestClient(app) as test_client:
        test_client.cookies.set("canvas_sweeper_session", "test-session-token")
        test_client.cookies.set("canvas_sweeper_csrf", "test-csrf-token")
        test_client.headers["X-CSRF-Token"] = "test-csrf-token"
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def anonymous_client(tmp_path: Path) -> Generator[TestClient, None, None]:
    database_path = tmp_path / "anonymous.sqlite3"
    engine = create_engine(f"sqlite:///{database_path}", connect_args={"check_same_thread": False})
    testing_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    with testing_session() as database:
        seed_database(database)

    def override_database() -> Generator[Session, None, None]:
        with testing_session() as database:
            yield database

    app.dependency_overrides[get_db] = override_database
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
