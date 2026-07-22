import uuid
from copy import deepcopy
from typing import Annotated, Literal, cast
from urllib.parse import quote, urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models import UserProfile
from app.schemas.phase2 import ActionStatusSchema, SessionStatusSchema, UserSchema
from app.services.auth import (
    OAuthStateSigner,
    SessionGrant,
    consume_oauth_state,
    create_oauth_state,
    create_session,
    get_current_session,
    get_optional_session,
    require_csrf,
    revoke_session,
)
from app.services.demo_data import DEFAULT_SETTINGS
from app.services.google import IDENTITY_SCOPES, GoogleProvider, GoogleProviderError
from app.services.workspace import initialize_user_workspace

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]
CurrentSession = Annotated[SessionGrant, Depends(get_current_session)]
CsrfSession = Annotated[SessionGrant, Depends(require_csrf)]


def safe_workspace_destination(value: str | None) -> str:
    if not value or not value.startswith("/") or value.startswith("//") or len(value) > 2048:
        return "/overview"
    allowed = ("/overview", "/assignments", "/canvai", "/insights", "/settings", "/profile")
    return value if value.split("?", 1)[0] in allowed else "/overview"


def get_google_provider(settings: AppSettings) -> GoogleProvider:
    return GoogleProvider(settings)


def user_schema(user: UserProfile) -> UserSchema:
    if not user.email:
        raise HTTPException(status_code=500, detail="Authenticated user is missing an email")
    return UserSchema(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        profile_photo=user.profile_photo,
        timezone=user.time_zone,
        onboarding_complete=user.onboarding_complete,
        preferred_theme=cast(
            Literal["light", "dark", "system"],
            user.theme if user.theme in {"light", "dark", "system"} else "system",
        ),
        school_year=user.school_year,
        week_starts_on=cast(
            Literal["monday", "sunday"],
            user.week_start if user.week_start in {"monday", "sunday"} else "monday",
        ),
        bedtime=user.bedtime,
        wake_time=user.wake_time,
        rowing_schedule=user.rowing_schedule,
        default_study_duration=user.default_study_duration,
        preferred_calendar=user.preferred_calendar,
        calendar_consent=user.calendar_consent,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def state_signer(settings: Settings) -> OAuthStateSigner:
    try:
        return OAuthStateSigner(settings.oauth_state_secret)
    except ValueError as error:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured") from error


def set_session_cookies(
    response: Response,
    token: str,
    csrf_token: str,
    remember: bool,
    settings: Settings,
) -> None:
    max_age = settings.remember_session_days * 86400 if remember else settings.session_hours * 3600
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=max_age,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        "canvas_sweeper_csrf",
        csrf_token,
        max_age=max_age,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


@router.get("/session", response_model=SessionStatusSchema)
def session_status(
    request: Request,
    grant: Annotated[SessionGrant | None, Depends(get_optional_session)],
) -> SessionStatusSchema:
    if not grant:
        return SessionStatusSchema(authenticated=False)
    csrf_token = request.cookies.get("canvas_sweeper_csrf")
    return SessionStatusSchema(
        authenticated=True,
        expires_at=grant.session.expires_at,
        csrf_token=csrf_token,
        reauthentication_required=False,
    )


@router.get("/me", response_model=UserSchema)
def current_user(grant: CurrentSession) -> UserSchema:
    return user_schema(grant.user)


@router.get("/google/start")
def google_sign_in_start(
    request: Request,
    database: DbSession,
    settings: AppSettings,
    provider: Annotated[GoogleProvider, Depends(get_google_provider)],
    remember: bool = Query(default=True),
    next_path: str | None = Query(default=None, alias="next"),
) -> RedirectResponse:
    if not provider.configured():
        raise HTTPException(status_code=503, detail="Google Sign-In is not configured")
    state, binding = create_oauth_state(
        database,
        state_signer(settings),
        "login",
        bind_browser=True,
        requester_key=request.client.host if request.client else "unknown",
        remember=remember,
        destination=safe_workspace_destination(next_path),
    )
    response = RedirectResponse(
        provider.authorization_url(
            state=state,
            redirect_uri=settings.google_auth_redirect_uri,
            scopes=IDENTITY_SCOPES,
            prompt="select_account",
        ),
        status_code=302,
    )
    response.set_cookie(
        "canvas_sweeper_oauth_binding",
        binding or "",
        max_age=600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/api/v1/auth/google/callback",
    )
    return response


@router.get("/google/callback")
def google_sign_in_callback(
    request: Request,
    database: DbSession,
    settings: AppSettings,
    provider: Annotated[GoogleProvider, Depends(get_google_provider)],
    state: str,
    code: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    claims = consume_oauth_state(
        database,
        state_signer(settings),
        state,
        "login",
        browser_binding=request.cookies.get("canvas_sweeper_oauth_binding"),
    )
    if error or not code:
        query = urlencode({"error": error or "oauth_denied"})
        return RedirectResponse(f"{settings.frontend_url}/login?{query}", status_code=302)
    try:
        tokens = provider.exchange_code(code, settings.google_auth_redirect_uri)
        identity = provider.userinfo(str(tokens["access_token"]))
    except (GoogleProviderError, KeyError) as provider_error:
        query = urlencode({"error": getattr(provider_error, "code", "oauth_failed")})
        return RedirectResponse(f"{settings.frontend_url}/login?{query}", status_code=302)
    google_id = str(identity.get("sub", ""))
    email = str(identity.get("email", "")).strip().casefold()
    if not google_id or not email or identity.get("email_verified") is not True:
        raise HTTPException(status_code=400, detail="Google did not provide a verified identity")
    subject_user = database.scalar(select(UserProfile).where(UserProfile.google_id == google_id))
    email_user = database.scalar(select(UserProfile).where(func.lower(UserProfile.email) == email))
    if subject_user and email_user and subject_user.id != email_user.id:
        raise HTTPException(
            status_code=409, detail="Google identity conflicts with an existing account"
        )
    if not subject_user and email_user and email_user.google_id:
        raise HTTPException(
            status_code=409, detail="This email is linked to another Google account"
        )
    user = subject_user or email_user
    if not user:
        user = UserProfile(
            id=f"user-{uuid.uuid4().hex}",
            google_id=google_id,
            email=email,
            display_name=str(identity.get("name") or email.split("@", 1)[0]),
            profile_photo=str(identity.get("picture")) if identity.get("picture") else None,
            time_zone="UTC",
            school_year="",
            week_start="monday",
            theme="system",
            onboarding_complete=False,
        )
        database.add(user)
        database.flush()
        initial_settings = deepcopy(DEFAULT_SETTINGS)
        profile_payload = initial_settings.get("profile")
        if not isinstance(profile_payload, dict):
            profile_payload = {}
        initial_settings["profile"] = {
            **profile_payload,
            "id": user.id,
            "display_name": user.display_name,
            "time_zone": user.time_zone,
            "school_year": user.school_year,
            "week_start": user.week_start,
            "theme": user.theme,
        }
        initialize_user_workspace(database, user.id, initial_settings)
        database.commit()
        database.refresh(user)
    else:
        user.google_id = google_id
        user.email = email
        user.display_name = str(identity.get("name") or user.display_name)
        user.profile_photo = (
            str(identity.get("picture")) if identity.get("picture") else user.profile_photo
        )
        database.commit()
    remember = bool(claims.get("remember", True))
    new_session = create_session(database, user, remember, settings)
    requested_destination = safe_workspace_destination(str(claims.get("destination", "")))
    destination = (
        requested_destination
        if user.onboarding_complete
        else f"/onboarding?next={quote(requested_destination, safe='')}"
    )
    response = RedirectResponse(f"{settings.frontend_url}{destination}", status_code=302)
    set_session_cookies(response, new_session.token, new_session.csrf_token, remember, settings)
    return response


@router.post("/logout", response_model=ActionStatusSchema)
def logout(
    response: Response,
    database: DbSession,
    settings: AppSettings,
    grant: CsrfSession,
) -> ActionStatusSchema:
    revoke_session(database, grant.session)
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie("canvas_sweeper_csrf", path="/")
    return ActionStatusSchema(status="logged_out", message="You have been signed out.")
