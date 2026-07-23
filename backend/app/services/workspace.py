from copy import deepcopy
from datetime import datetime
from typing import Any, cast

from sqlalchemy.orm import Session

from app.core.datetime_utils import as_utc
from app.models import Assignment, Course, Notification, RoutineBlock, StudySession, UserSettings
from app.services.demo_data import ASSIGNMENTS, COURSES, NOTIFICATIONS, ROUTINE, SESSIONS


def initialize_user_workspace(
    database: Session, user_id: str, settings_payload: dict[str, Any]
) -> None:
    """Create an isolated deterministic Phase 1 workspace for a first-time user."""
    course_ids = {item["id"]: f"{user_id}:{item['id']}" for item in COURSES}
    assignment_ids = {item["id"]: f"{user_id}:{item['id']}" for item in ASSIGNMENTS}
    session_ids = {item["id"]: f"{user_id}:{item['id']}" for item in SESSIONS}

    database.add_all(
        [Course(user_id=user_id, **{**item, "id": course_ids[item["id"]]}) for item in COURSES]
    )
    database.flush()
    for item in ASSIGNMENTS:
        database.add(
            Assignment(
                id=assignment_ids[item["id"]],
                course_id=course_ids[str(item["course_id"])],
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
            StudySession(
                **{
                    **item,
                    "id": session_ids[item["id"]],
                    "assignment_id": assignment_ids[item["assignment_id"]],
                    "start_at": as_utc(cast(datetime, item["start_at"])),
                }
            )
            for item in SESSIONS
        ]
    )
    database.add_all(
        [
            RoutineBlock(user_id=user_id, **{**item, "id": f"{user_id}:{item['id']}"})
            for item in ROUTINE
        ]
    )
    database.add_all(
        [
            Notification(user_id=user_id, **{**item, "id": f"{user_id}:{item['id']}"})
            for item in NOTIFICATIONS
        ]
    )

    payload = deepcopy(settings_payload)
    for subject in payload.get("subjects", []):
        original_id = subject.get("course_id")
        if original_id in course_ids:
            subject["course_id"] = course_ids[original_id]
    database.add(UserSettings(id=f"settings-{user_id}", user_id=user_id, payload=payload))
