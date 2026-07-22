from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth_routes import get_google_provider, state_signer
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models import OAuthCredential
from app.schemas.phase2 import (
    ActionStatusSchema,
    BusySyncRequest,
    BusySyncSchema,
    CalendarConnectionSchema,
    CalendarPreferencesSchema,
    CalendarSchema,
    StudyCalendarCreate,
    StudyCalendarSchema,
    StudySessionPreviewSchema,
    StudySessionPublishRequest,
    StudySessionPublishSchema,
)
from app.services import calendar as calendar_service
from app.services.auth import (
    SessionGrant,
    consume_oauth_state,
    create_oauth_state,
    get_current_session,
    require_csrf,
)
from app.services.calendar import CredentialCipher
from app.services.google import (
    CALENDAR_SCOPES,
    IDENTITY_SCOPES,
    GoogleProvider,
    GoogleProviderError,
)

router = APIRouter(prefix="/api/v1/calendar", tags=["calendar"])
DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]
CurrentSession = Annotated[SessionGrant, Depends(get_current_session)]
CsrfSession = Annotated[SessionGrant, Depends(require_csrf)]
Provider = Annotated[GoogleProvider, Depends(get_google_provider)]


def cipher(settings: Settings) -> CredentialCipher:
    try:
        return CredentialCipher(
            settings.credential_encryption_key,
            current_version=settings.credential_encryption_key_version,
            previous_keys=settings.credential_encryption_previous_keys,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=503, detail="Google credential encryption is not configured"
        ) from error


@router.get("/status", response_model=CalendarConnectionSchema)
def connection_status(database: DbSession, grant: CurrentSession) -> CalendarConnectionSchema:
    return calendar_service.connection_schema(
        calendar_service.get_connection(database, grant.user.id)
    )


@router.get("/connect")
def connect_calendar(
    database: DbSession,
    settings: AppSettings,
    provider: Provider,
    grant: CurrentSession,
    reconnect: bool = Query(default=False),
) -> RedirectResponse:
    if not grant.user.calendar_consent:
        raise HTTPException(
            status_code=403, detail="Calendar consent is required before connecting"
        )
    if not provider.configured():
        raise HTTPException(status_code=503, detail="Google Calendar OAuth is not configured")
    state, _ = create_oauth_state(
        database,
        state_signer(settings),
        "calendar",
        user_id=grant.user.id,
        reconnect=reconnect,
    )
    return RedirectResponse(
        provider.authorization_url(
            state=state,
            redirect_uri=settings.google_calendar_redirect_uri,
            scopes=[*IDENTITY_SCOPES, *CALENDAR_SCOPES],
            prompt="consent",
        ),
        status_code=302,
    )


@router.get("/oauth/callback")
def calendar_callback(
    database: DbSession,
    settings: AppSettings,
    provider: Provider,
    grant: CurrentSession,
    state: str,
    code: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    consume_oauth_state(database, state_signer(settings), state, "calendar", user_id=grant.user.id)
    if error or not code:
        query = urlencode({"calendar_error": error or "oauth_denied"})
        return RedirectResponse(f"{settings.frontend_url}/settings?{query}", status_code=302)
    try:
        tokens = provider.exchange_code(code, settings.google_calendar_redirect_uri)
        identity = provider.userinfo(str(tokens["access_token"]))
        calendar_service.save_connection(database, grant.user, tokens, identity, cipher(settings))
    except (GoogleProviderError, KeyError) as provider_error:
        query = urlencode({"calendar_error": getattr(provider_error, "code", "oauth_failed")})
        return RedirectResponse(f"{settings.frontend_url}/settings?{query}", status_code=302)
    return RedirectResponse(f"{settings.frontend_url}/settings?calendar=connected", status_code=302)


@router.post("/disconnect", response_model=ActionStatusSchema)
def disconnect_calendar(database: DbSession, grant: CsrfSession) -> ActionStatusSchema:
    calendar_service.disconnect(database, grant.user.id)
    return ActionStatusSchema(
        status="disconnected", message="Google Calendar was disconnected locally."
    )


@router.post("/revoke", response_model=ActionStatusSchema)
def revoke_calendar(
    database: DbSession,
    settings: AppSettings,
    provider: Provider,
    grant: CsrfSession,
) -> ActionStatusSchema:
    connection = calendar_service.get_connection(database, grant.user.id)
    if not connection:
        return ActionStatusSchema(
            status="disconnected", message="Google Calendar is not connected."
        )
    credential = database.scalar(
        select(OAuthCredential).where(OAuthCredential.connection_id == connection.id)
    )
    revocation_warning: str | None = None
    try:
        if credential:
            token = calendar_service.access_token(database, connection, provider, cipher(settings))
            provider.revoke(token)
    except (GoogleProviderError, HTTPException):
        revocation_warning = (
            "Google revocation could not be confirmed. Local credentials were deleted."
        )
    finally:
        calendar_service.disconnect(database, grant.user.id)
    if revocation_warning:
        return ActionStatusSchema(status="disconnected_with_warning", message=revocation_warning)
    return ActionStatusSchema(
        status="revoked", message="Google permissions were revoked and credentials were deleted."
    )


@router.get("/calendars", response_model=list[CalendarSchema])
def calendars(
    database: DbSession,
    settings: AppSettings,
    provider: Provider,
    grant: CurrentSession,
) -> list[CalendarSchema]:
    return calendar_service.discover_calendars(database, grant.user.id, provider, cipher(settings))


@router.post("/study-calendar", response_model=StudyCalendarSchema)
def create_study_calendar(
    payload: StudyCalendarCreate,
    database: DbSession,
    settings: AppSettings,
    provider: Provider,
    grant: CsrfSession,
) -> StudyCalendarSchema:
    return calendar_service.create_study_calendar(
        database, grant.user, payload.name, provider, cipher(settings)
    )


@router.post("/sync-busy", response_model=BusySyncSchema)
def sync_busy(
    payload: BusySyncRequest,
    database: DbSession,
    settings: AppSettings,
    provider: Provider,
    grant: CsrfSession,
) -> BusySyncSchema:
    return calendar_service.sync_busy_events(
        database,
        grant.user,
        payload.time_min,
        payload.time_max,
        provider,
        cipher(settings),
    )


@router.get("/preferences", response_model=CalendarPreferencesSchema)
def read_preferences(database: DbSession, grant: CurrentSession) -> CalendarPreferencesSchema:
    return CalendarPreferencesSchema.model_validate(
        calendar_service.preferences(database, grant.user.id)
    )


@router.patch("/preferences", response_model=CalendarPreferencesSchema)
def save_preferences(
    payload: CalendarPreferencesSchema,
    database: DbSession,
    settings: AppSettings,
    provider: Provider,
    grant: CsrfSession,
) -> CalendarPreferencesSchema:
    return CalendarPreferencesSchema.model_validate(
        calendar_service.update_preferences(
            database, grant.user.id, payload, provider, cipher(settings)
        )
    )


@router.post("/study-sessions/{session_id}/publish", response_model=StudySessionPublishSchema)
def publish_study_session(
    session_id: str,
    database: DbSession,
    settings: AppSettings,
    provider: Provider,
    grant: CsrfSession,
    payload: Annotated[StudySessionPublishRequest | None, Body()] = None,
) -> StudySessionPublishSchema:
    request = payload or StudySessionPublishRequest()
    return calendar_service.publish_study_session(
        database,
        grant.user,
        session_id,
        provider,
        cipher(settings),
        state_signer(settings),
        request.confirmation_token,
    )


@router.get("/study-sessions/{session_id}/preview", response_model=StudySessionPreviewSchema)
def preview_study_session(
    session_id: str,
    database: DbSession,
    settings: AppSettings,
    grant: CurrentSession,
) -> StudySessionPreviewSchema:
    return calendar_service.preview_study_session(
        database, grant.user, session_id, state_signer(settings)
    )
