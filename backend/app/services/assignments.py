from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.datetime_utils import as_utc
from app.models import Assignment, Course
from app.schemas.domain import AssignmentAnalysis, AssignmentSchema, AssignmentUpdate


def to_schema(assignment: Assignment) -> AssignmentSchema:
    return AssignmentSchema(
        id=assignment.id,
        course_id=assignment.course_id,
        title=assignment.title,
        description=assignment.description,
        type=assignment.assignment_type,
        due_at=as_utc(assignment.due_at),
        points=assignment.points,
        grade_weight=assignment.grade_weight,
        estimated_minutes=assignment.estimated_minutes,
        actual_minutes=assignment.actual_minutes,
        priority=assignment.priority,
        submission_status=assignment.submission_status,
        missing=assignment.missing,
        completion_state=assignment.completion_state,
        scheduled_session_ids=[session.id for session in assignment.sessions],
        analysis=AssignmentAnalysis(
            difficulty=assignment.difficulty,
            urgency=assignment.urgency,
            priority_score=assignment.priority_score,
            explanation=assignment.canvai_explanation,
            suggested_steps=assignment.suggested_steps,
        ),
        canvas_url=assignment.canvas_url,
    )


def list_assignments(database: Session, user_id: str = "user-demo") -> list[AssignmentSchema]:
    statement = (
        select(Assignment)
        .join(Assignment.course)
        .where(Course.user_id == user_id)
        .options(selectinload(Assignment.sessions))
        .order_by(Assignment.priority_score.desc())
    )
    return [to_schema(item) for item in database.scalars(statement).all()]


def get_assignment(
    database: Session, assignment_id: str, user_id: str = "user-demo"
) -> AssignmentSchema | None:
    statement = (
        select(Assignment)
        .join(Assignment.course)
        .where(Assignment.id == assignment_id, Course.user_id == user_id)
        .options(selectinload(Assignment.sessions))
    )
    item = database.scalar(statement)
    return to_schema(item) if item else None


def update_assignment(
    database: Session,
    assignment_id: str,
    patch: AssignmentUpdate,
    user_id: str = "user-demo",
) -> AssignmentSchema | None:
    statement = (
        select(Assignment)
        .join(Assignment.course)
        .where(Assignment.id == assignment_id, Course.user_id == user_id)
        .options(selectinload(Assignment.sessions))
    )
    item = database.scalar(statement)
    if not item:
        return None
    for field, value in patch.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    database.commit()
    database.refresh(item)
    return to_schema(item)
