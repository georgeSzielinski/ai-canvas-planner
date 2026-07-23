import hashlib
import json
import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.datetime_utils import as_utc as aware_utc
from app.core.datetime_utils import utcnow
from app.models import (
    Assignment,
    BusyEventCache,
    CalendarConnection,
    CalendarPreference,
    CalendarSyncHistory,
    Course,
    Notification,
    OAuthCredential,
    StudySession,
    UserProfile,
)
from app.schemas.phase2 import (
    BusyEventSchema,
    BusySyncSchema,
    CalendarConnectionSchema,
    CalendarPreferencesSchema,
    CalendarSchema,
    StudyCalendarSchema,
    StudySessionPreviewSchema,
    StudySessionPublishSchema,
)
from app.services.auth import OAuthStateSigner
from app.services.google import CALENDAR_SCOPES, GoogleProvider, GoogleProviderError


class CredentialCipher:
    def __init__(
        self, key: str, *, current_version: int = 1, previous_keys: dict[int, str] | None = None
    ) -> None:
        if not key:
            raise ValueError("Credential encryption key is not configured")
        self.current_version = current_version
        try:
            self.fernets = {
                **{
                    version: Fernet(previous_key.encode("ascii"))
                    for version, previous_key in (previous_keys or {}).items()
                },
                current_version: Fernet(key.encode("ascii")),
            }
        except (ValueError, TypeError) as error:
            raise ValueError("Credential encryption key must be a Fernet key") from error

    def encrypt(self, value: str) -> str:
        return self.fernets[self.current_version].encrypt(value.encode("utf-8")).decode("ascii")

    def decrypt(self, value: str, *, key_version: int | None = None) -> str:
        try:
            version = self.current_version if key_version is None else key_version
            return self.fernets[version].decrypt(value.encode("ascii")).decode("utf-8")
        except (InvalidToken, KeyError) as error:
            raise HTTPException(
                status_code=503,
                detail="Stored Google credentials cannot be decrypted. Reconnect your account.",
            ) from error


def notify(database: Session, user_id: str, title: str, body: str) -> None:
    database.add(
        Notification(
            id=f"notification-{uuid.uuid4().hex}",
            user_id=user_id,
            title=title,
            body=body,
            time_label="now",
            kind="connection",
            read=False,
        )
    )


def get_connection(database: Session, user_id: str) -> CalendarConnection | None:
    return database.scalar(select(CalendarConnection).where(CalendarConnection.user_id == user_id))


def connection_schema(connection: CalendarConnection | None) -> CalendarConnectionSchema:
    if not connection:
        return CalendarConnectionSchema(connected=False, status="not_connected")
    expired = connection.status == "reauthentication_required"
    return CalendarConnectionSchema(
        connected=connection.status == "connected",
        status=connection.status,
        provider_email=connection.provider_email,
        permissions=connection.scopes,
        last_sync_at=connection.last_sync_at,
        last_error=connection.last_error,
        reauthentication_required=expired,
    )


def save_connection(
    database: Session,
    user: UserProfile,
    token_payload: dict[str, object],
    provider_identity: dict[str, object],
    cipher: CredentialCipher,
) -> CalendarConnection:
    access_token = str(token_payload.get("access_token", ""))
    if not access_token:
        raise HTTPException(status_code=502, detail="Google did not return an access token")
    granted_scopes = set(str(token_payload.get("scope", "")).split())
    missing_scopes = set(CALENDAR_SCOPES) - granted_scopes
    if missing_scopes:
        raise GoogleProviderError(
            "missing_permissions",
            "Google Calendar did not grant every required permission. Reconnect and approve all requested permissions.",
            403,
        )
    connection = get_connection(database, user.id)
    if not connection:
        connection = CalendarConnection(id=f"calendar-{uuid.uuid4().hex}", user_id=user.id)
        database.add(connection)
        database.flush()
    connection.provider_account_id = str(provider_identity.get("sub", "")) or None
    connection.provider_email = str(provider_identity.get("email", "")) or user.email
    connection.status = "connected"
    connection.last_error = None
    connection.connected_at = utcnow()
    connection.scopes = str(token_payload.get("scope", "")).split()
    credential = database.scalar(
        select(OAuthCredential).where(OAuthCredential.connection_id == connection.id)
    )
    expires_raw = token_payload.get("expires_in", 3600)
    expires_in = int(expires_raw) if isinstance(expires_raw, (str, int)) else 3600
    refresh_token = token_payload.get("refresh_token")
    if not credential:
        credential = OAuthCredential(
            id=f"credential-{uuid.uuid4().hex}",
            connection_id=connection.id,
            encrypted_access_token=cipher.encrypt(access_token),
            encrypted_refresh_token=(cipher.encrypt(str(refresh_token)) if refresh_token else None),
            expires_at=utcnow() + timedelta(seconds=expires_in),
            scope=str(token_payload.get("scope", "")),
            token_type=str(token_payload.get("token_type", "Bearer")),
            key_version=cipher.current_version,
        )
        database.add(credential)
    else:
        credential.encrypted_access_token = cipher.encrypt(access_token)
        if refresh_token:
            credential.encrypted_refresh_token = cipher.encrypt(str(refresh_token))
        credential.expires_at = utcnow() + timedelta(seconds=expires_in)
        credential.scope = str(token_payload.get("scope", credential.scope))
        credential.token_type = str(token_payload.get("token_type", credential.token_type))
        credential.key_version = cipher.current_version
    preference = database.scalar(
        select(CalendarPreference).where(CalendarPreference.user_id == user.id)
    )
    if not preference:
        database.add(CalendarPreference(id=f"calendar-pref-{uuid.uuid4().hex}", user_id=user.id))
    notify(database, user.id, "Calendar connected", "Google Calendar is ready to sync busy time.")
    database.commit()
    database.refresh(connection)
    return connection


def access_token(
    database: Session,
    connection: CalendarConnection,
    provider: GoogleProvider,
    cipher: CredentialCipher,
) -> str:
    credential = database.scalar(
        select(OAuthCredential).where(OAuthCredential.connection_id == connection.id)
    )
    if not credential:
        raise HTTPException(status_code=409, detail="Google Calendar must be connected first")
    if credential.expires_at and aware_utc(credential.expires_at) <= utcnow() + timedelta(
        minutes=2
    ):
        if not credential.encrypted_refresh_token:
            connection.status = "reauthentication_required"
            connection.last_error = "Google permissions expired"
            notify(
                database,
                connection.user_id,
                "Permissions expired",
                "Reconnect Google Calendar to continue.",
            )
            database.commit()
            raise HTTPException(status_code=401, detail="Reconnect Google Calendar to continue")
        try:
            refresh_secret = cipher.decrypt(
                credential.encrypted_refresh_token, key_version=credential.key_version
            )
            refreshed = provider.refresh_token(refresh_secret)
        except GoogleProviderError as error:
            connection.status = "reauthentication_required"
            connection.last_error = str(error)
            notify(database, connection.user_id, "Reauthentication required", str(error))
            database.commit()
            raise HTTPException(status_code=error.status_code, detail=str(error)) from error
        credential.encrypted_access_token = cipher.encrypt(str(refreshed["access_token"]))
        credential.encrypted_refresh_token = cipher.encrypt(refresh_secret)
        credential.expires_at = utcnow() + timedelta(seconds=int(refreshed.get("expires_in", 3600)))
        credential.key_version = cipher.current_version
        connection.status = "connected"
        connection.last_error = None
        database.commit()
    access = cipher.decrypt(credential.encrypted_access_token, key_version=credential.key_version)
    if credential.key_version != cipher.current_version:
        credential.encrypted_access_token = cipher.encrypt(access)
        if credential.encrypted_refresh_token:
            refresh = cipher.decrypt(
                credential.encrypted_refresh_token, key_version=credential.key_version
            )
            credential.encrypted_refresh_token = cipher.encrypt(refresh)
        credential.key_version = cipher.current_version
        database.commit()
    return access


def preferences(database: Session, user_id: str) -> CalendarPreference:
    item = database.scalar(select(CalendarPreference).where(CalendarPreference.user_id == user_id))
    if item:
        return item
    item = CalendarPreference(id=f"calendar-pref-{uuid.uuid4().hex}", user_id=user_id)
    database.add(item)
    database.commit()
    database.refresh(item)
    return item


def update_preferences(
    database: Session,
    user_id: str,
    payload: CalendarPreferencesSchema,
    provider: GoogleProvider,
    cipher: CredentialCipher,
) -> CalendarPreference:
    item = preferences(database, user_id)
    connection = get_connection(database, user_id)
    selected_ids = [*payload.busy_calendar_ids]
    if payload.study_calendar_id:
        selected_ids.append(payload.study_calendar_id)
    if selected_ids:
        if not connection:
            raise HTTPException(status_code=409, detail="Connect Google Calendar first")
        try:
            calendars = provider.list_calendars(
                access_token(database, connection, provider, cipher)
            )
        except GoogleProviderError as error:
            _record_provider_error(database, connection, error)
            raise HTTPException(status_code=error.status_code, detail=str(error)) from error
        roles = {
            str(calendar.get("id")): str(calendar.get("accessRole", "none"))
            for calendar in calendars
        }
        if payload.study_calendar_id and roles.get(payload.study_calendar_id) not in {
            "writer",
            "owner",
        }:
            raise HTTPException(status_code=422, detail="Study calendar must be writable")
        unreadable = [
            calendar_id
            for calendar_id in payload.busy_calendar_ids
            if roles.get(calendar_id) not in {"reader", "writer", "owner"}
        ]
        if unreadable:
            raise HTTPException(status_code=422, detail="Busy calendars must be readable")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    if connection:
        connection.study_calendar_id = payload.study_calendar_id
    database.commit()
    database.refresh(item)
    return item


def discover_calendars(
    database: Session,
    user_id: str,
    provider: GoogleProvider,
    cipher: CredentialCipher,
) -> list[CalendarSchema]:
    connection = get_connection(database, user_id)
    if not connection:
        raise HTTPException(status_code=409, detail="Connect Google Calendar first")
    preference = preferences(database, user_id)
    try:
        items = provider.list_calendars(access_token(database, connection, provider, cipher))
    except GoogleProviderError as error:
        _record_provider_error(database, connection, error)
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    calendars = []
    for item in items:
        calendar_id = str(item.get("id", ""))
        access_role = str(item.get("accessRole", "none"))
        calendars.append(
            CalendarSchema(
                id=calendar_id,
                name=str(item.get("summaryOverride") or item.get("summary") or "Untitled calendar"),
                color=item.get("backgroundColor"),
                primary=bool(item.get("primary", False)),
                access_role=access_role,
                can_read=access_role in {"reader", "writer", "owner"},
                can_write=access_role in {"writer", "owner"},
                selected_for_busy=calendar_id in preference.busy_calendar_ids,
                selected_for_study=calendar_id == preference.study_calendar_id,
            )
        )
    return calendars


def create_study_calendar(
    database: Session,
    user: UserProfile,
    name: str,
    provider: GoogleProvider,
    cipher: CredentialCipher,
) -> StudyCalendarSchema:
    connection = get_connection(database, user.id)
    if not connection:
        raise HTTPException(status_code=409, detail="Connect Google Calendar first")
    try:
        created = provider.create_calendar(
            access_token(database, connection, provider, cipher), name, user.time_zone
        )
    except GoogleProviderError as error:
        _record_provider_error(database, connection, error)
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    calendar_id = str(created["id"])
    preference = preferences(database, user.id)
    preference.study_calendar_id = calendar_id
    connection.study_calendar_id = calendar_id
    notify(database, user.id, "Study calendar created", f"{name} is ready for study sessions.")
    database.commit()
    return StudyCalendarSchema(
        id=calendar_id,
        name=str(created.get("summary", name)),
        color=created.get("backgroundColor", "#1d4ed8"),
    )


def _event_time(value: dict[str, str], timezone: str) -> tuple[datetime, bool]:
    if "dateTime" in value:
        return datetime.fromisoformat(value["dateTime"].replace("Z", "+00:00")), False
    try:
        zone = ZoneInfo(timezone)
    except ZoneInfoNotFoundError as error:
        raise HTTPException(status_code=422, detail="Profile timezone is not recognized") from error
    return datetime.combine(date.fromisoformat(value["date"]), datetime.min.time(), zone), True


def _declined(event: dict[str, object]) -> bool:
    attendees = event.get("attendees", [])
    if not isinstance(attendees, list):
        return False
    return any(
        isinstance(item, dict)
        and item.get("self") is True
        and item.get("responseStatus") == "declined"
        for item in attendees
    )


def sync_busy_events(
    database: Session,
    user: UserProfile,
    time_min: datetime,
    time_max: datetime,
    provider: GoogleProvider,
    cipher: CredentialCipher,
) -> BusySyncSchema:
    connection = get_connection(database, user.id)
    if not connection:
        raise HTTPException(status_code=409, detail="Connect Google Calendar first")
    preference = preferences(database, user.id)
    history = CalendarSyncHistory(
        id=f"sync-{uuid.uuid4().hex}",
        user_id=user.id,
        connection_id=connection.id,
        status="running",
    )
    database.add(history)
    database.flush()
    imported: list[BusyEventCache] = []
    event_locations: dict[str, str] = {}
    try:
        token = access_token(database, connection, provider, cipher)
        for calendar_id in preference.busy_calendar_ids:
            for event in provider.list_events(
                token,
                calendar_id,
                aware_utc(time_min).isoformat(),
                aware_utc(time_max).isoformat(),
            ):
                if (
                    event.get("status") == "cancelled"
                    or event.get("transparency") == "transparent"
                    or _declined(event)
                ):
                    continue
                start, all_day = _event_time(event["start"], user.time_zone)
                end, _ = _event_time(event["end"], user.time_zone)
                item = BusyEventCache(
                    id=f"busy-{uuid.uuid4().hex}",
                    user_id=user.id,
                    connection_id=connection.id,
                    calendar_id=calendar_id,
                    provider_event_id=str(event["id"]),
                    starts_at=start,
                    ends_at=end,
                    all_day=all_day,
                    recurring_event_id=event.get("recurringEventId"),
                    status=str(event.get("status", "confirmed")),
                )
                imported.append(item)
                location = event.get("location")
                if isinstance(location, str) and location.strip():
                    event_locations[item.id] = location.strip()
    except (GoogleProviderError, KeyError, ValueError) as error:
        history.status = "failed"
        history.completed_at = utcnow()
        history.error_code = getattr(error, "code", "invalid_event")
        history.error_message = str(error)
        connection.last_error = str(error)
        if isinstance(error, GoogleProviderError):
            _record_provider_error(database, connection, error)
            if error.code not in {
                "credentials_expired",
                "missing_permissions",
                "calendar_unavailable",
            }:
                notify(database, user.id, "Calendar sync failed", str(error))
        else:
            notify(database, user.id, "Calendar sync failed", str(error))
        database.commit()
        status_code = getattr(error, "status_code", 502)
        raise HTTPException(status_code=status_code, detail=str(error)) from error
    if preference.busy_calendar_ids:
        database.execute(
            delete(BusyEventCache).where(
                BusyEventCache.connection_id == connection.id,
                BusyEventCache.calendar_id.in_(preference.busy_calendar_ids),
                BusyEventCache.starts_at < aware_utc(time_max),
                BusyEventCache.ends_at > aware_utc(time_min),
            )
        )
    database.add_all(imported)
    history.status = "completed"
    completed_at = utcnow()
    history.completed_at = completed_at
    history.events_imported = len(imported)
    connection.last_sync_at = history.completed_at
    connection.last_error = None
    notify(database, user.id, "Calendar sync completed", f"Imported {len(imported)} busy events.")
    database.commit()
    sorted_events = sorted(imported, key=lambda item: aware_utc(item.starts_at))
    conflicts = sum(
        aware_utc(current.starts_at) < aware_utc(previous.ends_at)
        for previous, current in zip(sorted_events, sorted_events[1:], strict=False)
    )
    travel_conflicts = sum(
        bool(event_locations.get(previous.id))
        and bool(event_locations.get(current.id))
        and event_locations[previous.id] != event_locations[current.id]
        and timedelta(0)
        <= aware_utc(current.starts_at) - aware_utc(previous.ends_at)
        < timedelta(minutes=30)
        for previous, current in zip(sorted_events, sorted_events[1:], strict=False)
    )
    cursor = aware_utc(time_min)
    free_blocks = 0
    for item in sorted_events:
        starts_at = max(aware_utc(item.starts_at), aware_utc(time_min))
        ends_at = min(aware_utc(item.ends_at), aware_utc(time_max))
        if starts_at > cursor:
            free_blocks += 1
        cursor = max(cursor, ends_at)
    if cursor < aware_utc(time_max):
        free_blocks += 1
    return BusySyncSchema(
        status="completed",
        imported_count=len(imported),
        all_day_count=sum(item.all_day for item in imported),
        recurring_count=sum(item.recurring_event_id is not None for item in imported),
        conflicts=conflicts,
        free_block_count=free_blocks,
        travel_conflict_count=travel_conflicts,
        overlapping_appointment_count=conflicts,
        synced_at=completed_at,
        events=[
            BusyEventSchema(
                calendar_id=item.calendar_id,
                provider_event_id=item.provider_event_id,
                starts_at=item.starts_at,
                ends_at=item.ends_at,
                all_day=item.all_day,
                recurring_event_id=item.recurring_event_id,
            )
            for item in imported
        ],
    )


def _owned_study_session(database: Session, user_id: str, session_id: str) -> StudySession:
    session = database.scalar(
        select(StudySession)
        .join(Assignment, StudySession.assignment_id == Assignment.id)
        .join(Course, Assignment.course_id == Course.id)
        .where(StudySession.id == session_id, Course.user_id == user_id)
    )
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")
    return session


def _study_event_payload(
    user_id: str, session: StudySession, preference: CalendarPreference
) -> dict[str, object]:
    end_at = aware_utc(session.start_at) + timedelta(minutes=session.duration_minutes)
    return {
        "id": f"cs{hashlib.sha256(f'{user_id}:{session.id}'.encode()).hexdigest()[:32]}",
        "summary": session.title,
        "description": (
            "Created by Canvas Sweeper. Review preparation notes in Canvas Sweeper."
            if preference.include_preparation_notes
            else "Created by Canvas Sweeper."
        ),
        "start": {"dateTime": aware_utc(session.start_at).isoformat()},
        "end": {"dateTime": end_at.isoformat()},
        "reminders": {
            "useDefault": False,
            "overrides": [{"method": "popup", "minutes": preference.default_reminder_minutes}],
        },
        "colorId": _google_color_id(preference.default_event_color),
        "extendedProperties": {"private": {"canvasSweeperSessionId": session.id}},
    }


def _google_color_id(color: str) -> str:
    palette = {
        "1": "#a4bdfc",
        "2": "#7ae7bf",
        "3": "#dbadff",
        "4": "#ff887c",
        "5": "#fbd75b",
        "6": "#ffb878",
        "7": "#46d6db",
        "8": "#e1e1e1",
        "9": "#5484ed",
        "10": "#51b749",
        "11": "#dc2127",
    }
    target = tuple(int(color[index : index + 2], 16) for index in (1, 3, 5))
    return min(
        palette,
        key=lambda color_id: sum(
            (component - int(palette[color_id][index : index + 2], 16)) ** 2
            for component, index in zip(target, (1, 3, 5), strict=True)
        ),
    )


def _payload_fingerprint(payload: dict[str, object]) -> str:
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def preview_study_session(
    database: Session, user: UserProfile, session_id: str, signer: OAuthStateSigner
) -> StudySessionPreviewSchema:
    session = _owned_study_session(database, user.id, session_id)
    preference = preferences(database, user.id)
    calendar_id = session.calendar_id if session.provider_event_id else preference.study_calendar_id
    if not calendar_id:
        raise HTTPException(status_code=409, detail="Choose a Canvas Sweeper study calendar first")
    payload = _study_event_payload(user.id, session, preference)
    fingerprint = _payload_fingerprint(payload)
    return StudySessionPreviewSchema(
        session_id=session.id,
        calendar_id=calendar_id,
        title=session.title,
        starts_at=aware_utc(session.start_at),
        ends_at=aware_utc(session.start_at) + timedelta(minutes=session.duration_minutes),
        reminder_minutes=preference.default_reminder_minutes,
        description=str(payload["description"]),
        confirmation_token=signer.dumps(
            "publish-preview", user_id=user.id, session_id=session.id, fingerprint=fingerprint
        ),
    )


def publish_study_session(
    database: Session,
    user: UserProfile,
    session_id: str,
    provider: GoogleProvider,
    cipher: CredentialCipher,
    signer: OAuthStateSigner,
    confirmation_token: str | None,
) -> StudySessionPublishSchema:
    session = _owned_study_session(database, user.id, session_id)
    connection = get_connection(database, user.id)
    preference = preferences(database, user.id)
    calendar_id = session.calendar_id if session.provider_event_id else preference.study_calendar_id
    if not connection or not calendar_id:
        raise HTTPException(status_code=409, detail="Choose a Canvas Sweeper study calendar first")
    token = access_token(database, connection, provider, cipher)
    payload = _study_event_payload(user.id, session, preference)
    fingerprint = _payload_fingerprint(payload)
    if preference.preview_before_publishing and not preference.publish_automatically:
        if not confirmation_token:
            raise HTTPException(
                status_code=409, detail="Preview and confirm this study event first"
            )
        claims = signer.loads(confirmation_token, "publish-preview")
        if (
            claims.get("user_id") != user.id
            or claims.get("session_id") != session.id
            or claims.get("fingerprint") != fingerprint
        ):
            raise HTTPException(status_code=409, detail="Study event changed after preview")
    try:
        if not session.provider_event_id:
            try:
                event = provider.insert_event(token, calendar_id, payload)
            except GoogleProviderError as error:
                if error.status_code != 409:
                    raise
                event = provider.get_event(token, calendar_id, str(payload["id"]))
                marker = (
                    event.get("extendedProperties", {})
                    .get("private", {})
                    .get("canvasSweeperSessionId")
                )
                if marker != session.id:
                    raise HTTPException(
                        status_code=409,
                        detail="Deterministic event ID is owned by another calendar event",
                    ) from error
            action = "created"
        else:
            existing = provider.get_event(token, calendar_id, session.provider_event_id)
            marker = (
                existing.get("extendedProperties", {})
                .get("private", {})
                .get("canvasSweeperSessionId")
            )
            if marker != session.id:
                raise HTTPException(
                    status_code=409,
                    detail="Refusing to modify an event not owned by Canvas Sweeper",
                )
            renamed = existing.get("summary") != session.title
            etag_changed = bool(
                session.provider_etag and existing.get("etag") != session.provider_etag
            )
            if (
                session.manually_edited
                or (preference.protect_manually_edited_events and etag_changed)
                or (preference.preserve_renamed_events and renamed)
            ):
                session.manually_edited = True
                database.commit()
                return StudySessionPublishSchema(
                    session_id=session.id,
                    calendar_id=calendar_id,
                    provider_event_id=session.provider_event_id,
                    action="protected",
                    published_at=session.published_at,
                )
            if session.last_published_hash == fingerprint:
                return StudySessionPublishSchema(
                    session_id=session.id,
                    calendar_id=calendar_id,
                    provider_event_id=session.provider_event_id,
                    action="unchanged",
                    published_at=session.published_at,
                )
            moved = (
                existing.get("start") != payload["start"] or existing.get("end") != payload["end"]
            )
            if moved and not preference.canvai_may_move_study_sessions:
                raise HTTPException(
                    status_code=409, detail="Calendar settings prevent moving study sessions"
                )
            event = provider.update_event(token, calendar_id, session.provider_event_id, payload)
            action = "updated"
    except GoogleProviderError as error:
        _record_provider_error(database, connection, error)
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    session.calendar_id = calendar_id
    session.provider_event_id = str(event["id"])
    session.provider_etag = event.get("etag")
    session.last_published_hash = fingerprint
    session.published_at = utcnow()
    session.manually_edited = False
    database.commit()
    return StudySessionPublishSchema(
        session_id=session.id,
        calendar_id=calendar_id,
        provider_event_id=str(session.provider_event_id),
        action=action,
        published_at=session.published_at,
    )


def disconnect(database: Session, user_id: str) -> None:
    connection = get_connection(database, user_id)
    if not connection:
        return
    database.delete(connection)
    notify(
        database, user_id, "Calendar disconnected", "Google Calendar access was removed locally."
    )
    database.commit()


def _record_provider_error(
    database: Session, connection: CalendarConnection, error: GoogleProviderError
) -> None:
    connection.last_error = str(error)
    if error.code in {"credentials_expired", "missing_permissions"}:
        connection.status = "reauthentication_required"
        notify(database, connection.user_id, "Reauthentication required", str(error))
    elif error.code == "calendar_unavailable":
        notify(database, connection.user_id, "Calendar unavailable", str(error))
    else:
        notify(database, connection.user_id, "Calendar connection error", str(error))
    database.commit()
