from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class UserProfile(TimestampMixin, Base):
    __tablename__ = "user_profiles"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120))
    time_zone: Mapped[str] = mapped_column(String(80))
    school_year: Mapped[str] = mapped_column(String(32))
    week_start: Mapped[str] = mapped_column(String(16), default="monday")
    theme: Mapped[str] = mapped_column(String(16), default="light")
    google_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    email: Mapped[str | None] = mapped_column(String(320), unique=True, index=True, nullable=True)
    profile_photo: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    bedtime: Mapped[str | None] = mapped_column(String(5), nullable=True)
    wake_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    rowing_schedule: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    default_study_duration: Mapped[int] = mapped_column(Integer, default=45)
    preferred_calendar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    calendar_consent: Mapped[bool] = mapped_column(Boolean, default=False)


class AuthSession(TimestampMixin, Base):
    __tablename__ = "auth_sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_token_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    remember_login: Mapped[bool] = mapped_column(Boolean, default=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OAuthStateLock(Base):
    __tablename__ = "oauth_state_locks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)


class OAuthState(TimestampMixin, Base):
    __tablename__ = "oauth_states"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    action: Mapped[str] = mapped_column(String(32), index=True)
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=True, index=True
    )
    browser_binding_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    requester_hash: Mapped[str] = mapped_column(String(64), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Course(TimestampMixin, Base):
    __tablename__ = "courses"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user_profiles.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    short_name: Mapped[str] = mapped_column(String(40))
    color: Mapped[str] = mapped_column(String(32))
    assignments: Mapped[list["Assignment"]] = relationship(back_populates="course")


class Assignment(TimestampMixin, Base):
    __tablename__ = "assignments"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str] = mapped_column(Text)
    assignment_type: Mapped[str] = mapped_column(String(32))
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    points: Mapped[int] = mapped_column(Integer, default=0)
    grade_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    actual_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    priority: Mapped[str] = mapped_column(String(16))
    priority_score: Mapped[int] = mapped_column(Integer)
    difficulty: Mapped[int] = mapped_column(Integer)
    urgency: Mapped[int] = mapped_column(Integer)
    submission_status: Mapped[str] = mapped_column(String(32))
    missing: Mapped[bool] = mapped_column(Boolean, default=False)
    completion_state: Mapped[str] = mapped_column(String(16), default="open")
    canvai_explanation: Mapped[str] = mapped_column(Text)
    suggested_steps: Mapped[list[str]] = mapped_column(JSON, default=list)
    canvas_url: Mapped[str] = mapped_column(String(500))
    course: Mapped[Course] = relationship(back_populates="assignments")
    sessions: Mapped[list["StudySession"]] = relationship(
        back_populates="assignment", cascade="all, delete-orphan"
    )


class StudySession(TimestampMixin, Base):
    __tablename__ = "study_sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    assignment_id: Mapped[str] = mapped_column(ForeignKey("assignments.id"), index=True)
    title: Mapped[str] = mapped_column(String(240))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(24))
    source: Mapped[str] = mapped_column(String(24), default="canvai")
    calendar_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    provider_etag: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_published_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    manually_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    assignment: Mapped[Assignment] = relationship(back_populates="sessions")


class RoutineBlock(TimestampMixin, Base):
    __tablename__ = "routine_blocks"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user_profiles.id"), index=True)
    day: Mapped[str] = mapped_column(String(16))
    activity: Mapped[str] = mapped_column(String(40))
    start_time: Mapped[str] = mapped_column(String(5))
    end_time: Mapped[str] = mapped_column(String(5))
    color: Mapped[str] = mapped_column(String(24))


class UserSettings(TimestampMixin, Base):
    __tablename__ = "user_settings"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user_profiles.id"), unique=True, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)


class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user_profiles.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    time_label: Mapped[str] = mapped_column(String(20))
    kind: Mapped[str] = mapped_column(String(24))
    read: Mapped[bool] = mapped_column(Boolean, default=False)


class ScheduleProposal(TimestampMixin, Base):
    __tablename__ = "schedule_proposals"
    id: Mapped[str] = mapped_column(String(96), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user_profiles.id"), index=True)
    command: Mapped[str] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(24), default="preview")
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)


class CalendarConnection(TimestampMixin, Base):
    __tablename__ = "calendar_connections"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), unique=True, index=True
    )
    provider: Mapped[str] = mapped_column(String(32), default="google")
    provider_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="connected")
    scopes: Mapped[list[str]] = mapped_column(JSON, default=list)
    connected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    study_calendar_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


class OAuthCredential(TimestampMixin, Base):
    __tablename__ = "oauth_credentials"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    connection_id: Mapped[str] = mapped_column(
        ForeignKey("calendar_connections.id", ondelete="CASCADE"), unique=True, index=True
    )
    encrypted_access_token: Mapped[str] = mapped_column(Text)
    encrypted_refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_type: Mapped[str] = mapped_column(String(32), default="Bearer")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scope: Mapped[str] = mapped_column(Text, default="")
    key_version: Mapped[int] = mapped_column(Integer, default=1)


class CalendarPreference(TimestampMixin, Base):
    __tablename__ = "calendar_preferences"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), unique=True, index=True
    )
    study_calendar_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    busy_calendar_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    publish_automatically: Mapped[bool] = mapped_column(Boolean, default=False)
    preview_before_publishing: Mapped[bool] = mapped_column(Boolean, default=True)
    default_reminder_minutes: Mapped[int] = mapped_column(Integer, default=10)
    default_event_color: Mapped[str] = mapped_column(String(32), default="#1d4ed8")
    protect_manually_edited_events: Mapped[bool] = mapped_column(Boolean, default=True)
    preserve_renamed_events: Mapped[bool] = mapped_column(Boolean, default=True)
    canvai_may_move_study_sessions: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_weekend_scheduling: Mapped[bool] = mapped_column(Boolean, default=True)
    include_preparation_notes: Mapped[bool] = mapped_column(Boolean, default=True)


class BusyEventCache(TimestampMixin, Base):
    __tablename__ = "busy_event_cache"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "calendar_id", "provider_event_id", name="uq_busy_event_provider"
        ),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), index=True
    )
    connection_id: Mapped[str] = mapped_column(
        ForeignKey("calendar_connections.id", ondelete="CASCADE"), index=True
    )
    calendar_id: Mapped[str] = mapped_column(String(255), index=True)
    provider_event_id: Mapped[str] = mapped_column(String(255))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    recurring_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="confirmed")


class CalendarSyncHistory(TimestampMixin, Base):
    __tablename__ = "calendar_sync_history"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), index=True
    )
    connection_id: Mapped[str] = mapped_column(
        ForeignKey("calendar_connections.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(32))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    events_imported: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
