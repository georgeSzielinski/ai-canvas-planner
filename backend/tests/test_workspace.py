from copy import deepcopy
from datetime import UTC
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models import Assignment, Course, StudySession, UserProfile, UserSettings
from app.services.demo_data import ASSIGNMENTS, DEFAULT_SETTINGS, SESSIONS
from app.services.workspace import initialize_user_workspace


def test_workspace_initialization_scopes_records_and_persists_utc(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'workspace.sqlite3'}")
    Base.metadata.create_all(engine)
    settings = deepcopy(DEFAULT_SETTINGS)
    settings["profile"]["id"] = "real-user"
    settings["profile"]["display_name"] = "Real User"

    with Session(engine, expire_on_commit=False) as database:
        database.add(
            UserProfile(
                id="real-user",
                display_name="Real User",
                time_zone="America/Los_Angeles",
                school_year="Junior",
            )
        )
        database.flush()
        initialize_user_workspace(database, "real-user", settings)
        database.commit()

    with Session(engine, expire_on_commit=False) as database:
        courses = database.scalars(select(Course).where(Course.user_id == "real-user")).all()
        assignment = database.scalar(
            select(Assignment).where(Assignment.id == "real-user:assignment-missing")
        )
        session = database.scalar(
            select(StudySession).where(StudySession.id == "real-user:session-seminar-1")
        )
        stored_settings = database.scalar(
            select(UserSettings).where(UserSettings.user_id == "real-user")
        )

    assert courses and all(course.id.startswith("real-user:") for course in courses)
    assert assignment is not None and assignment.due_at is not None
    source_assignment = next(item for item in ASSIGNMENTS if item["id"] == "assignment-missing")
    assert assignment.due_at == source_assignment["due_at"].astimezone(UTC).replace(tzinfo=None)
    assert session is not None
    source_session = next(item for item in SESSIONS if item["id"] == "session-seminar-1")
    assert session.start_at == source_session["start_at"].astimezone(UTC).replace(tzinfo=None)
    assert stored_settings is not None
    assert stored_settings.payload["profile"]["id"] == "real-user"
    assert stored_settings.payload["profile"]["display_name"] == "Real User"
