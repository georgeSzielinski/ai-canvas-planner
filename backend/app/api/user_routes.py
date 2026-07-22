from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth_routes import user_schema
from app.db.session import get_db
from app.models import UserSettings
from app.schemas.phase2 import OnboardingUpdate, UserSchema, UserUpdate
from app.services.auth import SessionGrant, get_current_session, require_csrf

router = APIRouter(prefix="/api/v1/user", tags=["user"])
DbSession = Annotated[Session, Depends(get_db)]
CurrentSession = Annotated[SessionGrant, Depends(get_current_session)]
CsrfSession = Annotated[SessionGrant, Depends(require_csrf)]


@router.get("/profile", response_model=UserSchema)
def profile(grant: CurrentSession) -> UserSchema:
    return user_schema(grant.user)


@router.patch("/profile", response_model=UserSchema)
def update_profile(
    payload: UserUpdate,
    database: DbSession,
    grant: CsrfSession,
) -> UserSchema:
    user = grant.user
    values = payload.model_dump(exclude_unset=True)
    if "display_name" in values:
        user.display_name = values["display_name"]
    if "timezone" in values:
        user.time_zone = values["timezone"]
    if "preferred_theme" in values:
        user.theme = values["preferred_theme"]
    if "school_year" in values:
        user.school_year = values["school_year"]
    if "week_starts_on" in values:
        user.week_start = values["week_starts_on"]
    if "calendar_consent" in values:
        user.calendar_consent = values["calendar_consent"]
    settings = database.scalar(select(UserSettings).where(UserSettings.user_id == user.id))
    if settings:
        stored_profile = settings.payload.get("profile", {})
        settings.payload = {
            **settings.payload,
            "profile": {
                **stored_profile,
                "display_name": user.display_name,
                "time_zone": user.time_zone,
                "school_year": user.school_year,
                "week_start": user.week_start,
                "theme": user.theme,
            },
        }
    database.commit()
    database.refresh(user)
    return user_schema(user)


@router.put("/onboarding", response_model=UserSchema)
def complete_onboarding(
    payload: OnboardingUpdate,
    database: DbSession,
    grant: CsrfSession,
) -> UserSchema:
    user = grant.user
    user.school_year = payload.school_year
    user.time_zone = payload.timezone
    user.week_start = payload.week_starts_on
    user.bedtime = payload.bedtime
    user.wake_time = payload.wake_time
    user.rowing_schedule = payload.rowing_schedule
    user.default_study_duration = payload.default_study_duration
    user.preferred_calendar = payload.preferred_calendar
    user.calendar_consent = payload.calendar_consent
    user.onboarding_complete = True
    settings = database.scalar(select(UserSettings).where(UserSettings.user_id == user.id))
    if settings:
        settings.payload = {
            **settings.payload,
            "profile": {
                **settings.payload.get("profile", {}),
                "display_name": user.display_name,
                "time_zone": user.time_zone,
                "school_year": user.school_year,
                "week_start": user.week_start,
                "theme": user.theme,
            },
            "study": {
                **settings.payload.get("study", {}),
                "preferred_session_minutes": user.default_study_duration,
            },
            "sleep": {
                **settings.payload.get("sleep", {}),
                "current_bedtime": user.bedtime,
                "target_bedtime": user.bedtime,
                "wake_time": user.wake_time,
            },
        }
    database.commit()
    database.refresh(user)
    return user_schema(user)
