import uuid
from collections.abc import AsyncIterator
from datetime import datetime, timedelta
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings, get_settings
from app.core.datetime_utils import as_utc, utcnow
from app.db.session import get_db
from app.models import Assignment, CanvasConnection, CanvasSubmissionState, CanvasSyncRun, Course
from app.schemas.canvas import (
    CanvasAssignmentPage,
    CanvasAssignmentSchema,
    CanvasConnectionSchema,
    CanvasCourseSchema,
    CanvasCourseSelection,
    CanvasSyncReportSchema,
    CanvasSyncRequest,
)
from app.services.auth import SessionGrant, get_current_session, require_csrf
from app.services.canvas_client import (
    CanvasApiClient,
    CanvasCredentialProvider,
    CanvasProviderError,
    EnvironmentCanvasCredentialProvider,
)
from app.services.canvas_sync import (
    CanvasSyncClient,
    CanvasSyncInProgress,
    report_from_run,
    synchronize_canvas,
)

router = APIRouter(prefix="/api/v1/canvas", tags=["canvas"])
DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]
CurrentSession = Annotated[SessionGrant, Depends(get_current_session)]
CsrfSession = Annotated[SessionGrant, Depends(require_csrf)]


def get_canvas_credential_provider(settings: AppSettings) -> CanvasCredentialProvider:
    return EnvironmentCanvasCredentialProvider(settings)


async def get_canvas_client(
    settings: AppSettings,
    grant: CurrentSession,
    provider: Annotated[CanvasCredentialProvider, Depends(get_canvas_credential_provider)],
) -> AsyncIterator[CanvasApiClient]:
    credentials = provider.for_user(grant.user.id)
    if credentials is None:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "not_configured",
                "message": "Canvas is not configured. Add local credentials to the server environment.",
            },
        )
    client = CanvasApiClient(settings, credentials=credentials)
    try:
        yield client
    finally:
        await client.aclose()


CanvasClient = Annotated[CanvasSyncClient, Depends(get_canvas_client)]


def _now() -> datetime:
    return utcnow()


def _connection(database: Session, user_id: str) -> CanvasConnection | None:
    return database.scalar(select(CanvasConnection).where(CanvasConnection.user_id == user_id))


def _configured(settings: Settings) -> bool:
    return EnvironmentCanvasCredentialProvider(settings).configured()


def _connection_schema(
    connection: CanvasConnection | None,
    *,
    configured: bool,
) -> CanvasConnectionSchema:
    if not configured:
        return CanvasConnectionSchema(connected=False, configured=False, status="not_configured")
    if connection is None:
        return CanvasConnectionSchema(connected=False, configured=True, status="not_verified")
    last_successful_sync_at = as_utc(connection.last_successful_sync_at)
    stale = (
        last_successful_sync_at is None
        or last_successful_sync_at < _now() - timedelta(hours=24)
        or connection.last_sync_status in {"partial", "failed", "interrupted"}
    )
    return CanvasConnectionSchema(
        connected=connection.status == "connected",
        configured=True,
        status=connection.status,
        canvas_display_name=connection.canvas_display_name,
        canvas_user_id=connection.canvas_user_id,
        hostname=connection.hostname,
        last_verified_at=as_utc(connection.last_verified_at),
        last_successful_sync_at=last_successful_sync_at,
        last_attempted_sync_at=as_utc(connection.last_attempted_sync_at),
        last_sync_status=connection.last_sync_status,
        last_error_code=connection.last_error_code,
        include_concluded_courses=connection.include_concluded_courses,
        data_stale=stale,
    )


def _provider_http_error(error: CanvasProviderError) -> HTTPException:
    return HTTPException(
        status_code=error.status_code,
        detail={"code": error.code, "message": str(error)},
    )


@router.get("/status", response_model=CanvasConnectionSchema)
def canvas_status(
    database: DbSession,
    settings: AppSettings,
    grant: CurrentSession,
) -> CanvasConnectionSchema:
    return _connection_schema(
        _connection(database, grant.user.id), configured=_configured(settings)
    )


@router.post("/verify", response_model=CanvasConnectionSchema)
async def verify_canvas_connection(
    database: DbSession,
    settings: AppSettings,
    grant: CsrfSession,
    client: CanvasClient,
) -> CanvasConnectionSchema:
    connection = _connection(database, grant.user.id)
    if connection is None:
        connection = CanvasConnection(
            id=f"canvas-connection-{uuid.uuid4().hex}",
            user_id=grant.user.id,
            hostname=urlsplit(settings.canvas_base_url).hostname or "",
        )
        database.add(connection)
    try:
        identity = await client.verify()
    except CanvasProviderError as error:
        connection.status = "reconnect_required" if error.code == "invalid_token" else error.code
        connection.last_error_code = error.code
        database.commit()
        raise _provider_http_error(error) from error
    connection.hostname = urlsplit(settings.canvas_base_url).hostname or ""
    connection.canvas_user_id = str(identity.id)
    connection.canvas_display_name = identity.display_name
    connection.status = "connected"
    connection.last_verified_at = _now()
    connection.last_error_code = None
    database.commit()
    database.refresh(connection)
    return _connection_schema(connection, configured=True)


@router.post("/sync", response_model=CanvasSyncReportSchema)
async def sync_canvas(
    payload: CanvasSyncRequest,
    database: DbSession,
    settings: AppSettings,
    grant: CsrfSession,
    client: CanvasClient,
) -> CanvasSyncReportSchema:
    try:
        report = await synchronize_canvas(
            database,
            grant.user.id,
            client,
            base_url=settings.canvas_base_url,
            include_concluded=payload.include_concluded,
        )
    except CanvasSyncInProgress as error:
        raise HTTPException(
            status_code=409,
            detail={"code": "sync_in_progress", "message": str(error)},
        ) from error
    except CanvasProviderError as error:
        raise _provider_http_error(error) from error
    return CanvasSyncReportSchema.model_validate(report.model_dump())


@router.get("/sync/latest", response_model=CanvasSyncReportSchema)
def latest_canvas_sync(database: DbSession, grant: CurrentSession) -> CanvasSyncReportSchema:
    run = database.scalar(
        select(CanvasSyncRun)
        .where(CanvasSyncRun.user_id == grant.user.id)
        .order_by(CanvasSyncRun.started_at.desc(), CanvasSyncRun.id.desc())
    )
    if run is None:
        raise HTTPException(status_code=404, detail="No Canvas synchronization has run yet")
    return CanvasSyncReportSchema.model_validate(report_from_run(run).model_dump())


def _course_schema(database: Session, course: Course) -> CanvasCourseSchema:
    count = database.scalar(
        select(func.count())
        .select_from(Assignment)
        .where(Assignment.course_id == course.id, Assignment.archived.is_(False))
    )
    return CanvasCourseSchema(
        id=course.id,
        canvas_course_id=course.canvas_course_id or "",
        name=course.name,
        course_code=course.course_code,
        enrollment_state=course.enrollment_state,
        workflow_state=course.workflow_state,
        term_name=course.term_name,
        start_at=as_utc(course.start_at),
        end_at=as_utc(course.end_at),
        concluded=course.concluded,
        favorite=course.favorite,
        selected_for_sync=course.selected_for_sync,
        archived=course.archived,
        assignment_count=int(count or 0),
        last_seen_at=as_utc(course.last_seen_at),
    )


@router.get("/courses", response_model=list[CanvasCourseSchema])
def list_canvas_courses(
    database: DbSession,
    grant: CurrentSession,
    include_concluded: bool = Query(default=False),
    include_archived: bool = Query(default=False),
) -> list[CanvasCourseSchema]:
    statement = select(Course).where(
        Course.user_id == grant.user.id,
        Course.canvas_course_id.is_not(None),
    )
    if not include_concluded:
        statement = statement.where(Course.concluded.is_(False))
    if not include_archived:
        statement = statement.where(Course.archived.is_(False))
    statement = statement.order_by(func.lower(Course.name), Course.canvas_course_id)
    return [_course_schema(database, item) for item in database.scalars(statement).all()]


@router.patch("/courses/{course_id}", response_model=CanvasCourseSchema)
def select_canvas_course(
    course_id: str,
    payload: CanvasCourseSelection,
    database: DbSession,
    grant: CsrfSession,
) -> CanvasCourseSchema:
    course = database.scalar(
        select(Course).where(
            Course.id == course_id,
            Course.user_id == grant.user.id,
            Course.canvas_course_id.is_not(None),
        )
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Canvas course not found")
    course.selected_for_sync = payload.selected_for_sync
    database.commit()
    database.refresh(course)
    return _course_schema(database, course)


def _assignment_schema(assignment: Assignment) -> CanvasAssignmentSchema:
    course = assignment.course
    submission = assignment.canvas_submission
    now = _now()
    lock_at = as_utc(assignment.lock_at)
    return CanvasAssignmentSchema(
        id=assignment.id,
        canvas_assignment_id=assignment.canvas_assignment_id or "",
        course_id=course.id,
        course_name=course.name,
        title=assignment.title,
        description=assignment.description,
        category=assignment.assignment_type,
        category_reason=assignment.category_reason,
        canvas_url=assignment.canvas_url or None,
        due_at=as_utc(assignment.due_at),
        unlock_at=as_utc(assignment.unlock_at),
        lock_at=lock_at,
        points_possible=assignment.points,
        submission_types=assignment.submission_types,
        assignment_group=assignment.assignment_group,
        grading_type=assignment.grading_type,
        published=assignment.published,
        omitted_from_final_grade=assignment.omitted_from_final_grade,
        peer_reviews=assignment.peer_reviews,
        workflow_state=submission.workflow_state if submission else None,
        submission_status=assignment.submission_status,
        submitted_at=as_utc(submission.submitted_at) if submission else None,
        graded_at=as_utc(submission.graded_at) if submission else None,
        score=submission.score if submission else None,
        grade=submission.grade if submission else None,
        late=submission.late if submission else False,
        missing=submission.missing if submission else assignment.missing,
        excused=submission.excused if submission else False,
        attempt_count=submission.attempt_count if submission else None,
        seconds_late=submission.seconds_late if submission else None,
        completed=assignment.completion_state == "completed",
        locked=bool(lock_at and lock_at <= now),
        archived=assignment.archived,
        concluded_course=course.concluded,
        canvas_created_at=as_utc(assignment.canvas_created_at),
        canvas_updated_at=as_utc(assignment.canvas_updated_at),
        first_seen_at=as_utc(assignment.first_seen_at),
        last_seen_at=as_utc(assignment.last_seen_at),
    )


@router.get("/assignments", response_model=CanvasAssignmentPage)
def list_canvas_assignments(
    database: DbSession,
    grant: CurrentSession,
    course_id: str | None = None,
    upcoming: bool = False,
    completed: bool = False,
    missing: bool = False,
    late: bool = False,
    no_due_date: bool = False,
    include_concluded: bool = False,
    include_archived: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> CanvasAssignmentPage:
    statement = (
        select(Assignment)
        .join(Assignment.course)
        .outerjoin(Assignment.canvas_submission)
        .where(
            Assignment.user_id == grant.user.id,
            Assignment.canvas_assignment_id.is_not(None),
        )
    )
    if course_id:
        statement = statement.where(Assignment.course_id == course_id)
    if upcoming:
        statement = statement.where(
            Assignment.due_at.is_not(None),
            Assignment.due_at >= _now(),
            Assignment.completion_state != "completed",
        )
    if completed:
        statement = statement.where(Assignment.completion_state == "completed")
    if missing:
        statement = statement.where(CanvasSubmissionState.missing.is_(True))
    if late:
        statement = statement.where(CanvasSubmissionState.late.is_(True))
    if no_due_date:
        statement = statement.where(Assignment.due_at.is_(None))
    if not include_concluded:
        statement = statement.where(Course.concluded.is_(False))
    if not include_archived:
        statement = statement.where(
            Assignment.archived.is_(False),
            Course.archived.is_(False),
        )
    count_statement = select(func.count()).select_from(statement.order_by(None).subquery())
    total = int(database.scalar(count_statement) or 0)
    statement = (
        statement.options(
            selectinload(Assignment.course), selectinload(Assignment.canvas_submission)
        )
        .order_by(
            case((Assignment.due_at.is_(None), 1), else_=0),
            Assignment.due_at.asc(),
            func.lower(Assignment.title),
            Assignment.id,
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = list(database.scalars(statement).unique().all())
    return CanvasAssignmentPage(
        items=[_assignment_schema(item) for item in items],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/assignments/{assignment_id}", response_model=CanvasAssignmentSchema)
def canvas_assignment_detail(
    assignment_id: str,
    database: DbSession,
    grant: CurrentSession,
) -> CanvasAssignmentSchema:
    assignment = database.scalar(
        select(Assignment)
        .where(
            Assignment.id == assignment_id,
            Assignment.user_id == grant.user.id,
            Assignment.canvas_assignment_id.is_not(None),
        )
        .options(selectinload(Assignment.course), selectinload(Assignment.canvas_submission))
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Canvas assignment not found")
    return _assignment_schema(assignment)
