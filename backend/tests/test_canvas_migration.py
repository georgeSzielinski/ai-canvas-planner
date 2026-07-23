import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from alembic import command
from app.core.config import get_settings
from app.models import Assignment, Course, StudySession, UserProfile


def test_phase_three_downgrade_removes_dependents_of_null_due_assignments(
    tmp_path: Path,
    monkeypatch,
) -> None:
    database_path = tmp_path / "migration.sqlite3"
    database_url = f"sqlite:///{database_path}"
    monkeypatch.setenv("CANVAS_SWEEPER_DATABASE_URL", database_url)
    get_settings.cache_clear()
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))

    command.upgrade(config, "head")
    engine = create_engine(database_url)
    with Session(engine) as database:
        database.add(
            UserProfile(
                id="migration-user",
                display_name="Migration User",
                time_zone="America/Los_Angeles",
                school_year="2026",
                onboarding_complete=True,
                rowing_schedule=[],
                calendar_consent=False,
            )
        )
        database.flush()
        database.add(
            Course(
                id="migration-course",
                user_id="migration-user",
                name="Migration course",
                short_name="Migration",
                color="accent",
                canvas_course_id="42",
                selected_for_sync=True,
                archived=False,
            )
        )
        database.flush()
        database.add(
            Assignment(
                id="migration-assignment",
                user_id="migration-user",
                course_id="migration-course",
                canvas_assignment_id="84",
                title="No due date",
                description="",
                assignment_type="assignment",
                category_reason="Migration test",
                due_at=None,
                points=1,
                estimated_minutes=0,
                priority="low",
                priority_score=0,
                difficulty=1,
                urgency=1,
                submission_status="not_started",
                missing=False,
                completion_state="open",
                canvai_explanation="Migration test",
                suggested_steps=[],
                canvas_url="",
                source_hash="migration-hash",
            )
        )
        database.flush()
        database.add(
            StudySession(
                id="migration-session",
                assignment_id="migration-assignment",
                title="Dependent session",
                start_at=datetime.now(UTC),
                duration_minutes=30,
                status="planned",
                source="manual",
            )
        )
        database.commit()
    engine.dispose()

    command.downgrade(config, "20260721_0004")

    connection = sqlite3.connect(database_path)
    try:
        assert connection.execute("SELECT COUNT(*) FROM assignments").fetchone() == (0,)
        assert connection.execute("SELECT COUNT(*) FROM study_sessions").fetchone() == (0,)
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
    finally:
        connection.close()
        get_settings.cache_clear()
