import asyncio
import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Protocol
from urllib.parse import urlsplit

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Assignment, CanvasConnection, CanvasSubmissionState, CanvasSyncRun, Course
from app.services.canvas_client import (
    CanvasAssignmentPayload,
    CanvasCoursePayload,
    CanvasIdentity,
    CanvasProviderError,
)
from app.services.canvas_content import (
    classify_assignment,
    sanitize_canvas_html,
    validate_canvas_url,
)


class CanvasSyncInProgress(RuntimeError):
    pass


class CanvasSyncClient(Protocol):
    async def verify(self) -> CanvasIdentity: ...

    async def list_courses(self, *, include_concluded: bool) -> list[CanvasCoursePayload]: ...

    async def list_assignments(self, course_id: int) -> list[CanvasAssignmentPayload]: ...


class CanvasSyncReport(BaseModel):
    id: str
    status: str
    courses_checked: int = 0
    courses_imported: int = 0
    assignments_created: int = 0
    assignments_updated: int = 0
    assignments_unchanged: int = 0
    assignments_archived: int = 0
    submission_states_updated: int = 0
    course_failures: int = 0
    warnings: list[str] = Field(default_factory=list)
    started_at: datetime
    completed_at: datetime | None = None
    error_code: str | None = None


_locks: dict[str, asyncio.Lock] = {}


def utcnow() -> datetime:
    return datetime.now(UTC)


def _stable_id(prefix: str, user_id: str, source_id: int | str) -> str:
    digest = hashlib.sha256(f"{user_id}:{source_id}".encode()).hexdigest()[:24]
    return f"{prefix}-{digest}"


def _connection(database: Session, user_id: str, base_url: str) -> CanvasConnection:
    item = database.scalar(select(CanvasConnection).where(CanvasConnection.user_id == user_id))
    hostname = urlsplit(base_url).hostname or ""
    if item is None:
        item = CanvasConnection(
            id=_stable_id("canvas-connection", user_id, hostname),
            user_id=user_id,
            hostname=hostname,
        )
        database.add(item)
    else:
        item.hostname = hostname
    return item


def _start_run(database: Session, user_id: str) -> CanvasSyncRun:
    now = utcnow()
    stale_before = now - timedelta(minutes=30)
    running = list(
        database.scalars(
            select(CanvasSyncRun).where(
                CanvasSyncRun.user_id == user_id,
                CanvasSyncRun.status == "running",
            )
        ).all()
    )
    if any(item.started_at >= stale_before for item in running):
        raise CanvasSyncInProgress("A Canvas synchronization is already running for this user.")
    for item in running:
        item.status = "interrupted"
        item.completed_at = now
        item.error_code = "process_interrupted"
        item.warnings = [
            *item.warnings,
            "A previous synchronization was interrupted before completion.",
        ]
    run = CanvasSyncRun(
        id=f"canvas-sync-{hashlib.sha256(f'{user_id}:{now.isoformat()}'.encode()).hexdigest()[:24]}",
        user_id=user_id,
        status="running",
        started_at=now,
    )
    database.add(run)
    try:
        database.commit()
    except IntegrityError as error:
        database.rollback()
        raise CanvasSyncInProgress(
            "A Canvas synchronization is already running for this user."
        ) from error
    return run


def _course_is_concluded(course: CanvasCoursePayload) -> bool:
    return course.enrollment_state == "completed" or course.workflow_state in {
        "completed",
        "concluded",
        "deleted",
    }


def _upsert_course(
    database: Session,
    user_id: str,
    payload: CanvasCoursePayload,
    now: datetime,
    warnings: list[str],
) -> Course:
    canvas_id = str(payload.id)
    item = database.scalar(
        select(Course).where(Course.user_id == user_id, Course.canvas_course_id == canvas_id)
    )
    name = (payload.name or "").strip()
    if not name:
        name = f"Untitled Canvas course {canvas_id}"
        warnings.append(
            f"Course {canvas_id} had no name and was imported with a safe fallback name."
        )
    if item is None:
        item = Course(
            id=_stable_id("canvas-course", user_id, canvas_id),
            user_id=user_id,
            name=name[:120],
            short_name=(payload.course_code or name)[:40],
            color="accent",
            canvas_course_id=canvas_id,
            first_seen_at=now,
        )
        database.add(item)
    item.name = name[:120]
    item.short_name = (payload.course_code or name)[:40]
    item.course_code = payload.course_code
    item.enrollment_state = payload.enrollment_state
    item.workflow_state = payload.workflow_state
    item.term_id = str(payload.term.id) if payload.term and payload.term.id is not None else None
    item.term_name = payload.term.name if payload.term else None
    item.start_at = payload.start_at or (payload.term.start_at if payload.term else None)
    item.end_at = payload.end_at or (payload.term.end_at if payload.term else None)
    item.concluded = _course_is_concluded(payload)
    item.favorite = payload.is_favorite
    item.last_seen_at = now
    item.archived = False
    return item


def _assignment_hash(
    payload: CanvasAssignmentPayload,
    description: str,
    canvas_url: str,
    category: str,
) -> str:
    values = {
        "id": payload.id,
        "course_id": payload.course_id,
        "name": payload.name,
        "description": description,
        "canvas_url": canvas_url,
        "due_at": payload.due_at.isoformat() if payload.due_at else None,
        "unlock_at": payload.unlock_at.isoformat() if payload.unlock_at else None,
        "lock_at": payload.lock_at.isoformat() if payload.lock_at else None,
        "points_possible": payload.points_possible,
        "submission_types": payload.submission_types,
        "assignment_group_id": payload.assignment_group_id,
        "grading_type": payload.grading_type,
        "published": payload.published,
        "omit_from_final_grade": payload.omit_from_final_grade,
        "peer_reviews": payload.peer_reviews,
        "created_at": payload.created_at.isoformat() if payload.created_at else None,
        "updated_at": payload.updated_at.isoformat() if payload.updated_at else None,
        "category": category,
    }
    return hashlib.sha256(
        json.dumps(values, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _submission_status(payload: CanvasAssignmentPayload) -> tuple[str, str, bool]:
    submission = payload.submission
    if submission is None:
        return "not_started", "open", False
    workflow = submission.workflow_state or ""
    if submission.excused:
        return "graded", "completed", submission.missing
    if workflow == "graded":
        return "graded", "completed", submission.missing
    if workflow in {"submitted", "pending_review"} or submission.submitted_at:
        return "submitted", "completed", submission.missing
    return "not_started", "open", submission.missing


def _upsert_submission(
    database: Session,
    user_id: str,
    assignment: Assignment,
    payload: CanvasAssignmentPayload,
) -> bool:
    source = payload.submission
    if source is None:
        existing = database.scalar(
            select(CanvasSubmissionState).where(
                CanvasSubmissionState.assignment_id == assignment.id
            )
        )
        if existing is None:
            return False
        database.delete(existing)
        return True
    item = database.scalar(
        select(CanvasSubmissionState).where(CanvasSubmissionState.assignment_id == assignment.id)
    )
    values = {
        "workflow_state": source.workflow_state,
        "submitted": bool(source.submitted_at or source.workflow_state in {"submitted", "graded"}),
        "submitted_at": source.submitted_at,
        "graded_at": source.graded_at,
        "score": source.score,
        "grade": source.grade,
        "late": source.late,
        "missing": source.missing,
        "excused": source.excused,
        "attempt_count": source.attempt,
        "seconds_late": source.seconds_late,
        "last_source_update_at": source.updated_at,
    }
    if item is None:
        item = CanvasSubmissionState(
            id=_stable_id("canvas-submission", user_id, assignment.id),
            user_id=user_id,
            assignment_id=assignment.id,
            **values,
        )
        database.add(item)
        return True
    changed = any(getattr(item, field) != value for field, value in values.items())
    for field, value in values.items():
        setattr(item, field, value)
    return changed


def _upsert_assignment(
    database: Session,
    user_id: str,
    course: Course,
    payload: CanvasAssignmentPayload,
    base_url: str,
    now: datetime,
) -> tuple[str, bool]:
    canvas_id = str(payload.id)
    item = database.scalar(
        select(Assignment).where(
            Assignment.user_id == user_id,
            Assignment.canvas_assignment_id == canvas_id,
        )
    )
    description = sanitize_canvas_html(payload.description)
    canvas_url = validate_canvas_url(payload.html_url, base_url) or ""
    group = str(payload.assignment_group_id) if payload.assignment_group_id is not None else None
    classification = classify_assignment(payload.name, group, payload.submission_types)
    source_hash = _assignment_hash(payload, description, canvas_url, classification.category)
    change = "unchanged"
    if item is None:
        item = Assignment(
            id=_stable_id("canvas-assignment", user_id, canvas_id),
            user_id=user_id,
            course_id=course.id,
            canvas_assignment_id=canvas_id,
            title=payload.name[:240],
            description=description,
            assignment_type=classification.category,
            category_reason=classification.reason,
            due_at=payload.due_at,
            points=payload.points_possible or 0,
            estimated_minutes=0,
            priority="low",
            priority_score=0,
            difficulty=1,
            urgency=1,
            submission_status="not_started",
            missing=False,
            completion_state="open",
            canvai_explanation=classification.reason,
            suggested_steps=[],
            canvas_url=canvas_url,
            first_seen_at=now,
        )
        database.add(item)
        change = "created"
    elif item.source_hash != source_hash or item.archived:
        change = "updated"
    submission_status, completion_state, missing = _submission_status(payload)
    item.course_id = course.id
    item.title = payload.name[:240]
    item.description = description
    item.assignment_type = classification.category
    item.category_reason = classification.reason
    item.due_at = payload.due_at
    item.unlock_at = payload.unlock_at
    item.lock_at = payload.lock_at
    item.points = payload.points_possible or 0
    item.submission_types = payload.submission_types
    item.assignment_group = group
    item.grading_type = payload.grading_type
    item.published = payload.published
    item.omitted_from_final_grade = payload.omit_from_final_grade
    item.peer_reviews = payload.peer_reviews
    item.canvas_created_at = payload.created_at
    item.canvas_updated_at = payload.updated_at
    item.last_seen_at = now
    item.source_hash = source_hash
    item.archived = False
    item.deleted = False
    item.submission_status = submission_status
    item.completion_state = completion_state
    item.missing = missing
    item.canvas_url = canvas_url
    item.canvai_explanation = classification.reason
    database.flush()
    return change, _upsert_submission(database, user_id, item, payload)


def report_from_run(run: CanvasSyncRun) -> CanvasSyncReport:
    return CanvasSyncReport(
        id=run.id,
        status=run.status,
        courses_checked=run.courses_checked,
        courses_imported=run.courses_imported,
        assignments_created=run.assignments_created,
        assignments_updated=run.assignments_updated,
        assignments_unchanged=run.assignments_unchanged,
        assignments_archived=run.assignments_archived,
        submission_states_updated=run.submission_states_updated,
        course_failures=run.course_failures,
        warnings=run.warnings,
        started_at=run.started_at,
        completed_at=run.completed_at,
        error_code=run.error_code,
    )


async def _synchronize_canvas(
    database: Session,
    user_id: str,
    client: CanvasSyncClient,
    *,
    base_url: str,
    include_concluded: bool,
) -> CanvasSyncReport:
    lock = _locks.setdefault(user_id, asyncio.Lock())
    if lock.locked():
        raise CanvasSyncInProgress("A Canvas synchronization is already running for this user.")
    async with lock:
        run = _start_run(database, user_id)
        connection = _connection(database, user_id, base_url)
        connection.include_concluded_courses = include_concluded
        connection.last_attempted_sync_at = run.started_at
        database.commit()
        try:
            identity = await client.verify()
            now = utcnow()
            connection.canvas_user_id = str(identity.id)
            connection.canvas_display_name = identity.display_name
            connection.status = "connected"
            connection.last_verified_at = now
            connection.last_error_code = None
            courses = await client.list_courses(include_concluded=include_concluded)
        except CanvasProviderError as error:
            run.status = "failed"
            run.completed_at = utcnow()
            run.error_code = error.code
            connection.status = (
                "reconnect_required" if error.code == "invalid_token" else error.code
            )
            connection.last_sync_status = "failed"
            connection.last_error_code = error.code
            database.commit()
            raise

        run.courses_checked = len(courses)
        now = utcnow()
        imported_courses: list[Course] = []
        seen_course_ids: set[str] = set()
        for payload in sorted(courses, key=lambda item: item.id):
            course = _upsert_course(database, user_id, payload, now, run.warnings)
            imported_courses.append(course)
            seen_course_ids.add(str(payload.id))
        existing_courses = list(
            database.scalars(
                select(Course).where(
                    Course.user_id == user_id,
                    Course.canvas_course_id.is_not(None),
                )
            ).all()
        )
        for course in existing_courses:
            if course.canvas_course_id not in seen_course_ids and (
                include_concluded or not course.concluded
            ):
                course.archived = True
        run.courses_imported = len(imported_courses)
        database.commit()

        for course in sorted(imported_courses, key=lambda item: (item.name.casefold(), item.id)):
            if not course.selected_for_sync:
                continue
            if course.concluded and not include_concluded:
                continue
            try:
                source_assignments = await client.list_assignments(
                    int(course.canvas_course_id or "0")
                )
                seen_assignment_ids: set[str] = set()
                for assignment_payload in sorted(source_assignments, key=lambda item: item.id):
                    if str(assignment_payload.course_id) != course.canvas_course_id:
                        run.warnings.append(
                            f"Assignment {assignment_payload.id} reported a different course and was not imported."
                        )
                        continue
                    seen_assignment_ids.add(str(assignment_payload.id))
                    change, submission_changed = _upsert_assignment(
                        database, user_id, course, assignment_payload, base_url, utcnow()
                    )
                    if change == "created":
                        run.assignments_created += 1
                    elif change == "updated":
                        run.assignments_updated += 1
                    else:
                        run.assignments_unchanged += 1
                    if submission_changed:
                        run.submission_states_updated += 1
                existing = list(
                    database.scalars(
                        select(Assignment).where(
                            Assignment.user_id == user_id,
                            Assignment.course_id == course.id,
                            Assignment.canvas_assignment_id.is_not(None),
                            Assignment.archived.is_(False),
                        )
                    ).all()
                )
                for assignment in existing:
                    if assignment.canvas_assignment_id not in seen_assignment_ids:
                        assignment.archived = True
                        run.assignments_archived += 1
                database.commit()
            except CanvasProviderError as error:
                database.rollback()
                run = database.get(CanvasSyncRun, run.id) or run
                run.course_failures += 1
                run.warnings = [
                    *run.warnings,
                    f"Course {course.canvas_course_id} could not be synchronized ({error.code}). Existing data was preserved.",
                ]
                database.commit()

        completed_at = utcnow()
        run = database.get(CanvasSyncRun, run.id) or run
        run.status = "partial" if run.course_failures else "success"
        run.warnings = list(run.warnings)
        run.completed_at = completed_at
        connection = _connection(database, user_id, base_url)
        connection.last_sync_status = run.status
        connection.last_error_code = "partial_sync" if run.course_failures else None
        connection.status = "connected"
        if run.status == "success":
            connection.last_successful_sync_at = completed_at
        database.commit()
        return report_from_run(run)


async def synchronize_canvas(
    database: Session,
    user_id: str,
    client: CanvasSyncClient,
    *,
    base_url: str,
    include_concluded: bool,
) -> CanvasSyncReport:
    try:
        return await _synchronize_canvas(
            database,
            user_id,
            client,
            base_url=base_url,
            include_concluded=include_concluded,
        )
    except CanvasSyncInProgress:
        raise
    except BaseException as error:
        database.rollback()
        try:
            run = database.scalar(
                select(CanvasSyncRun)
                .where(
                    CanvasSyncRun.user_id == user_id,
                    CanvasSyncRun.status == "running",
                )
                .order_by(CanvasSyncRun.started_at.desc(), CanvasSyncRun.id.desc())
            )
            if run is not None:
                interrupted = isinstance(
                    error, (asyncio.CancelledError, KeyboardInterrupt, SystemExit)
                )
                run.status = "interrupted" if interrupted else "failed"
                run.completed_at = utcnow()
                run.error_code = "request_cancelled" if interrupted else "unexpected_error"
                run.warnings = [
                    *run.warnings,
                    (
                        "Canvas synchronization was interrupted before completion."
                        if interrupted
                        else "Canvas synchronization stopped because of an unexpected internal error."
                    ),
                ]
                connection = _connection(database, user_id, base_url)
                connection.last_sync_status = run.status
                connection.last_error_code = run.error_code
                database.commit()
        except Exception:
            database.rollback()
        raise
