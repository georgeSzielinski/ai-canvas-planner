from datetime import datetime
from typing import cast

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.datetime_utils import as_utc
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import (
    Assignment,
    AuthSession,
    BusyEventCache,
    CalendarConnection,
    CalendarPreference,
    CalendarSyncHistory,
    Course,
    Notification,
    OAuthCredential,
    OAuthStateLock,
    RoutineBlock,
    ScheduleProposal,
    StudySession,
    UserProfile,
    UserSettings,
)
from tests.fixtures.demo_data import (
    ASSIGNMENTS,
    COURSES,
    DEFAULT_SETTINGS,
    NOTIFICATIONS,
    ROUTINE,
    SESSIONS,
)


def seed_database(database: Session) -> None:
    if database.get(OAuthStateLock, 1) is None:
        database.add(OAuthStateLock(id=1))
        database.flush()
    for model in [
        CalendarSyncHistory,
        BusyEventCache,
        OAuthCredential,
        CalendarPreference,
        CalendarConnection,
        AuthSession,
        StudySession,
        ScheduleProposal,
        Notification,
        RoutineBlock,
        Assignment,
        Course,
        UserSettings,
        UserProfile,
    ]:
        database.execute(delete(model))
    database.add(
        UserProfile(
            id="user-demo",
            email="maya@example.test",
            display_name="Maya Kessler",
            time_zone="America/Los_Angeles",
            school_year="Junior",
            week_start="monday",
            theme="light",
            onboarding_complete=True,
        )
    )
    database.flush()
    database.add_all([Course(user_id="user-demo", **course) for course in COURSES])
    database.flush()
    for item in ASSIGNMENTS:
        database.add(
            Assignment(
                id=item["id"],
                course_id=item["course_id"],
                title=item["title"],
                description=item["description"],
                assignment_type=item["type"],
                due_at=as_utc(cast(datetime, item["due_at"])),
                points=item["points"],
                grade_weight=item["grade_weight"],
                estimated_minutes=item["estimated_minutes"],
                actual_minutes=item["actual_minutes"],
                priority=item["priority"],
                priority_score=item["priority_score"],
                difficulty=item["difficulty"],
                urgency=item["urgency"],
                submission_status=item["submission_status"],
                missing=item["missing"],
                completion_state=item["completion_state"],
                canvai_explanation=item["explanation"],
                suggested_steps=item["steps"],
                canvas_url=item["canvas_url"],
            )
        )
    database.flush()
    database.add_all(
        [
            StudySession(**{**item, "start_at": as_utc(cast(datetime, item["start_at"]))})
            for item in SESSIONS
        ]
    )
    database.add_all([RoutineBlock(user_id="user-demo", **item) for item in ROUTINE])
    database.add_all([Notification(user_id="user-demo", **item) for item in NOTIFICATIONS])
    database.add(UserSettings(id="settings-demo", user_id="user-demo", payload=DEFAULT_SETTINGS))
    database.add(CalendarPreference(id="calendar-pref-demo", user_id="user-demo"))
    database.commit()


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as database:
        seed_database(database)
    print("Canvas Sweeper demo database seeded.")


if __name__ == "__main__":
    main()
