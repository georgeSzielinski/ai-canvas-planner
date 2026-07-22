import base64
import hashlib
import hmac
import json
import secrets
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, cast

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models import AuthSession, OAuthState, OAuthStateLock, UserProfile

MAX_ACTIVE_OAUTH_STATES = 1000
MAX_OAUTH_STATES_PER_REQUESTER = 10


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def aware_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


@dataclass(frozen=True)
class SessionGrant:
    session: AuthSession
    user: UserProfile
    csrf_token: str | None = None


@dataclass(frozen=True)
class NewSession:
    token: str
    csrf_token: str
    expires_at: datetime


def create_session(
    database: Session, user: UserProfile, remember: bool, settings: Settings
) -> NewSession:
    token = secrets.token_urlsafe(48)
    csrf_token = secrets.token_urlsafe(32)
    lifetime = (
        timedelta(days=settings.remember_session_days)
        if remember
        else timedelta(hours=settings.session_hours)
    )
    expires_at = datetime.now(UTC) + lifetime
    database.add(
        AuthSession(
            id=f"session-{uuid.uuid4().hex}",
            user_id=user.id,
            token_hash=hash_secret(token),
            csrf_token_hash=hash_secret(csrf_token),
            expires_at=expires_at,
            last_seen_at=datetime.now(UTC),
            remember_login=remember,
        )
    )
    database.commit()
    return NewSession(token=token, csrf_token=csrf_token, expires_at=expires_at)


def resolve_session(
    request: Request,
    database: Session,
    settings: Settings,
    *,
    required: bool,
) -> SessionGrant | None:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        if required:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
            )
        return None
    session = database.scalar(
        select(AuthSession).where(AuthSession.token_hash == hash_secret(token))
    )
    now = datetime.now(UTC)
    if not session or session.revoked_at or aware_utc(session.expires_at) <= now:
        if required:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired. Sign in again.",
            )
        return None
    user = database.get(UserProfile, session.user_id)
    if not user:
        if required:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
            )
        return None
    session.last_seen_at = now
    database.commit()
    return SessionGrant(session=session, user=user)


def get_optional_session(
    request: Request,
    database: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> SessionGrant | None:
    return resolve_session(request, database, settings, required=False)


def get_current_session(
    request: Request,
    database: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> SessionGrant:
    grant = resolve_session(request, database, settings, required=True)
    assert grant is not None
    return grant


def require_csrf(
    request: Request,
    grant: Annotated[SessionGrant, Depends(get_current_session)],
) -> SessionGrant:
    supplied = request.headers.get("X-CSRF-Token", "")
    if not supplied or not hmac.compare_digest(
        hash_secret(supplied), grant.session.csrf_token_hash
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid CSRF token")
    return grant


def revoke_session(database: Session, session: AuthSession) -> None:
    session.revoked_at = datetime.now(UTC)
    database.commit()


class OAuthStateSigner:
    def __init__(self, secret: str, max_age_seconds: int = 600) -> None:
        if len(secret) < 32:
            raise ValueError("OAuth state secret must be at least 32 characters")
        self.secret = secret.encode("utf-8")
        self.max_age_seconds = max_age_seconds

    def dumps(self, action: str, **claims: Any) -> str:
        payload = {
            "action": action,
            "iat": int(time.time()),
            "nonce": secrets.token_urlsafe(16),
            **claims,
        }
        encoded = base64.urlsafe_b64encode(
            json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        ).rstrip(b"=")
        signature = hmac.new(self.secret, encoded, hashlib.sha256).digest()
        return f"{encoded.decode()}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"

    def loads(self, state: str, expected_action: str) -> dict[str, Any]:
        try:
            encoded_text, signature_text = state.split(".", 1)
            encoded = encoded_text.encode("ascii")
            signature = base64.urlsafe_b64decode(signature_text + "=" * (-len(signature_text) % 4))
            expected = hmac.new(self.secret, encoded, hashlib.sha256).digest()
            if not hmac.compare_digest(signature, expected):
                raise ValueError("invalid signature")
            raw = base64.urlsafe_b64decode(encoded_text + "=" * (-len(encoded_text) % 4))
            payload = json.loads(raw)
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            raise HTTPException(status_code=400, detail="Invalid OAuth state") from error
        if payload.get("action") != expected_action:
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        issued_at = payload.get("iat")
        age = time.time() - issued_at if isinstance(issued_at, int) else self.max_age_seconds + 1
        if age < -60 or age > self.max_age_seconds:
            raise HTTPException(status_code=400, detail="OAuth state expired")
        return cast(dict[str, Any], payload)


def create_oauth_state(
    database: Session,
    signer: OAuthStateSigner,
    action: str,
    *,
    user_id: str | None = None,
    bind_browser: bool = False,
    requester_key: str | None = None,
    **claims: Any,
) -> tuple[str, str | None]:
    now = datetime.now(UTC)
    requester = requester_key or (f"user:{user_id}" if user_id else "anonymous")
    requester_hash = hmac.new(
        signer.secret,
        f"oauth-requester:{action}:{requester}".encode(),
        hashlib.sha256,
    ).hexdigest()
    lock_result = cast(
        CursorResult[Any],
        database.execute(update(OAuthStateLock).where(OAuthStateLock.id == 1).values(id=1)),
    )
    if lock_result.rowcount != 1:
        database.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OAuth state storage is not initialized",
        )
    database.execute(
        delete(OAuthState).where(
            or_(OAuthState.expires_at <= now, OAuthState.consumed_at.is_not(None))
        )
    )
    requester_states = database.scalar(
        select(func.count())
        .select_from(OAuthState)
        .where(
            OAuthState.requester_hash == requester_hash,
            OAuthState.expires_at > now,
        )
    )
    if (requester_states or 0) >= MAX_OAUTH_STATES_PER_REQUESTER:
        database.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many sign-in requests. Wait briefly and retry.",
        )
    active_states = database.scalar(
        select(func.count()).select_from(OAuthState).where(OAuthState.expires_at > now)
    )
    if (active_states or 0) >= MAX_ACTIVE_OAUTH_STATES:
        oldest_ids = list(
            database.scalars(
                select(OAuthState.id)
                .where(OAuthState.expires_at > now)
                .order_by(OAuthState.created_at)
                .limit((active_states or 0) - MAX_ACTIVE_OAUTH_STATES + 1)
            )
        )
        if oldest_ids:
            database.execute(delete(OAuthState).where(OAuthState.id.in_(oldest_ids)))
    nonce = secrets.token_urlsafe(32)
    binding = secrets.token_urlsafe(32) if bind_browser else None
    database.add(
        OAuthState(
            id=hash_secret(nonce),
            action=action,
            user_id=user_id,
            browser_binding_hash=hash_secret(binding) if binding else None,
            requester_hash=requester_hash,
            expires_at=now + timedelta(seconds=signer.max_age_seconds),
        )
    )
    database.commit()
    return signer.dumps(action, nonce=nonce, user_id=user_id, **claims), binding


def consume_oauth_state(
    database: Session,
    signer: OAuthStateSigner,
    state: str,
    action: str,
    *,
    browser_binding: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    claims = signer.loads(state, action)
    nonce = claims.get("nonce")
    if not isinstance(nonce, str):
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    expected_binding = hash_secret(browser_binding) if browser_binding else None
    user_clause = OAuthState.user_id.is_(None) if user_id is None else OAuthState.user_id == user_id
    result = cast(
        CursorResult[Any],
        database.execute(
            update(OAuthState)
            .where(
                OAuthState.id == hash_secret(nonce),
                OAuthState.action == action,
                user_clause,
                OAuthState.browser_binding_hash == expected_binding,
                OAuthState.consumed_at.is_(None),
                OAuthState.expires_at > datetime.now(UTC),
            )
            .values(consumed_at=datetime.now(UTC))
        ),
    )
    if result.rowcount != 1:
        database.rollback()
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    database.commit()
    return claims
