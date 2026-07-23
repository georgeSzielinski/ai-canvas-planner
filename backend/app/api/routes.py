from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.datetime_utils import as_utc
from app.db.session import get_db
from app.models import Assignment, Course, Notification, RoutineBlock, StudySession, UserSettings
from app.schemas.domain import (
    AppSettingsSchema,
    AssignmentSchema,
    AssignmentUpdate,
    CanvaiProposalRequest,
    ConnectionSchema,
    CourseSchema,
    DemoBootstrapSchema,
    InsightMetricSchema,
    NotificationSchema,
    RoutineBlockSchema,
    ScheduleProposalSchema,
    StatusSchema,
    StudySessionSchema,
    WorkloadSchema,
    WorkspaceBootstrapSchema,
)
from app.schemas.phase2 import ActionStatusSchema
from app.services import assignments as assignment_service
from app.services.auth import SessionGrant, get_current_session, require_csrf
from app.services.canvai import propose
from app.services.demo_data import INSIGHTS, REFERENCE_DATE, WORKLOAD

DbSession = Annotated[Session, Depends(get_db)]
CurrentSession = Annotated[SessionGrant, Depends(get_current_session)]
CsrfSession = Annotated[SessionGrant, Depends(require_csrf)]
router = APIRouter()
api = APIRouter(prefix="/api/v1")


@router.get("/health", response_model=StatusSchema)
def health() -> StatusSchema:
    return StatusSchema(status="ok", service="canvas-sweeper-api")


@router.get("/ready", response_model=StatusSchema)
def ready(database: DbSession) -> StatusSchema:
    try:
        database.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable",
        ) from error
    return StatusSchema(status="ready", service="canvas-sweeper-api", database="available")


@api.get("/assignments", response_model=list[AssignmentSchema])
def assignments(database: DbSession, grant: CurrentSession) -> list[AssignmentSchema]:
    return assignment_service.list_assignments(database, grant.user.id)


@api.get("/assignments/{assignment_id}", response_model=AssignmentSchema)
def assignment_detail(
    assignment_id: str, database: DbSession, grant: CurrentSession
) -> AssignmentSchema:
    item = assignment_service.get_assignment(database, assignment_id, grant.user.id)
    if not item:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return item


@api.patch("/assignments/{assignment_id}", response_model=AssignmentSchema)
def assignment_update(
    assignment_id: str, patch: AssignmentUpdate, database: DbSession, grant: CsrfSession
) -> AssignmentSchema:
    item = assignment_service.update_assignment(database, assignment_id, patch, grant.user.id)
    if not item:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return item


@api.get("/settings", response_model=AppSettingsSchema)
def settings_read(database: DbSession, grant: CurrentSession) -> AppSettingsSchema:
    settings = database.scalar(select(UserSettings).where(UserSettings.user_id == grant.user.id))
    if not settings:
        raise HTTPException(status_code=404, detail="Demo settings not found")
    return AppSettingsSchema.model_validate(settings.payload)


@api.patch("/settings", response_model=AppSettingsSchema)
def settings_update(
    payload: AppSettingsSchema, database: DbSession, grant: CsrfSession
) -> AppSettingsSchema:
    settings = database.scalar(select(UserSettings).where(UserSettings.user_id == grant.user.id))
    if not settings:
        raise HTTPException(status_code=404, detail="Demo settings not found")
    settings.payload = payload.model_dump(mode="json")
    database.commit()
    return payload


@api.get("/insights", response_model=list[InsightMetricSchema])
def insights(_grant: CurrentSession) -> list[InsightMetricSchema]:
    return [InsightMetricSchema.model_validate(item) for item in INSIGHTS]


@api.get("/notifications", response_model=list[NotificationSchema])
def notifications(database: DbSession, grant: CurrentSession) -> list[Notification]:
    return list(
        database.scalars(
            select(Notification)
            .where(Notification.user_id == grant.user.id)
            .order_by(Notification.created_at.desc())
        ).all()
    )


@api.post("/notifications/{notification_id}/read", response_model=NotificationSchema)
def notification_read(
    notification_id: str, database: DbSession, grant: CsrfSession
) -> Notification:
    item = database.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == grant.user.id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")
    item.read = True
    database.commit()
    database.refresh(item)
    return item


@api.post("/notifications/read-all", response_model=ActionStatusSchema)
def notifications_read_all(database: DbSession, grant: CsrfSession) -> ActionStatusSchema:
    database.execute(
        update(Notification).where(Notification.user_id == grant.user.id).values(read=True)
    )
    database.commit()
    return ActionStatusSchema(status="updated", message="All notifications marked read.")


@api.delete("/notifications/{notification_id}", response_model=ActionStatusSchema)
def notification_dismiss(
    notification_id: str, database: DbSession, grant: CsrfSession
) -> ActionStatusSchema:
    item = database.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == grant.user.id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")
    database.delete(item)
    database.commit()
    return ActionStatusSchema(status="dismissed", message="Notification dismissed.")


@api.post("/canvai/proposals", response_model=ScheduleProposalSchema)
def canvai_proposal(payload: CanvaiProposalRequest, _grant: CsrfSession) -> ScheduleProposalSchema:
    return propose(payload.command)


def _workspace_bootstrap(database: Session, user_id: str) -> WorkspaceBootstrapSchema:
    stored_settings = database.scalar(select(UserSettings).where(UserSettings.user_id == user_id))
    if not stored_settings:
        raise HTTPException(status_code=503, detail="Workspace data has not been initialized")
    sessions = database.scalars(
        select(StudySession)
        .join(StudySession.assignment)
        .join(Assignment.course)
        .where(Course.user_id == user_id)
    ).all()
    routine = database.scalars(select(RoutineBlock).where(RoutineBlock.user_id == user_id)).all()
    notifications = database.scalars(
        select(Notification).where(Notification.user_id == user_id)
    ).all()
    return WorkspaceBootstrapSchema(
        courses=[
            CourseSchema.model_validate(item)
            for item in database.scalars(select(Course).where(Course.user_id == user_id))
        ],
        assignments=assignment_service.list_assignments(database, user_id),
        sessions=[
            StudySessionSchema(
                id=item.id,
                assignment_id=item.assignment_id,
                title=item.title,
                start_at=as_utc(item.start_at),
                duration_minutes=item.duration_minutes,
                status=item.status,
                source=item.source,
            )
            for item in sessions
        ],
        routine=[RoutineBlockSchema.model_validate(item) for item in routine],
        notifications=[NotificationSchema.model_validate(item) for item in notifications],
        workload=[],
        settings=AppSettingsSchema.model_validate(stored_settings.payload),
    )


@api.get("/workspace/bootstrap", response_model=WorkspaceBootstrapSchema)
def workspace_bootstrap(database: DbSession, grant: CurrentSession) -> WorkspaceBootstrapSchema:
    return _workspace_bootstrap(database, grant.user.id)


@api.get("/demo/bootstrap", response_model=DemoBootstrapSchema)
def demo_bootstrap(database: DbSession, grant: CurrentSession) -> DemoBootstrapSchema:
    workspace = _workspace_bootstrap(database, grant.user.id)
    return DemoBootstrapSchema(
        **workspace.model_dump(exclude={"workload"}),
        reference_date=REFERENCE_DATE,
        workload=[WorkloadSchema.model_validate(item) for item in WORKLOAD],
        canvas_connection=ConnectionSchema(
            provider="canvas",
            status="demo",
            last_sync="2 minutes ago",
            permissions=["Read assignments", "Read submission status"],
        ),
        calendar_connection=ConnectionSchema(
            provider="google-calendar",
            status="not_connected",
            permissions=["Read busy times", "Create study events"],
        ),
    )


router.include_router(api)
