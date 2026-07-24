from copy import deepcopy
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models import Assignment, Course, StudySession, UserProfile, UserSettings
from app.services.workspace import initialize_user_workspace
from tests.fixtures.demo_data import DEFAULT_SETTINGS


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
        assignment = database.scalar(select(Assignment))
        session = database.scalar(select(StudySession))
        stored_settings = database.scalar(
            select(UserSettings).where(UserSettings.user_id == "real-user")
        )

    assert courses == []
    assert assignment is None
    assert session is None
    assert stored_settings is not None
    assert stored_settings.payload["profile"]["id"] == "real-user"
    assert stored_settings.payload["profile"]["display_name"] == "Real User"
