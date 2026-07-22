from datetime import datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator


def validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError as error:
        raise ValueError("Timezone must be a valid IANA timezone") from error
    return value


def validate_clock(value: str) -> str:
    try:
        time.fromisoformat(value)
    except ValueError as error:
        raise ValueError("Time must be a valid 24-hour HH:MM value") from error
    return value


def validate_optional_timezone(value: str | None) -> str | None:
    return validate_timezone(value) if value is not None else None


class SessionStatusSchema(BaseModel):
    authenticated: bool
    expires_at: datetime | None = None
    csrf_token: str | None = None
    reauthentication_required: bool = False


class UserSchema(BaseModel):
    id: str
    email: str
    display_name: str
    profile_photo: str | None = None
    timezone: str
    onboarding_complete: bool
    preferred_theme: Literal["light", "dark", "system"]
    school_year: str
    week_starts_on: Literal["monday", "sunday"]
    bedtime: str | None
    wake_time: str | None
    rowing_schedule: list[dict[str, str]]
    default_study_duration: int
    preferred_calendar: str | None
    calendar_consent: bool
    created_at: datetime
    updated_at: datetime


class OnboardingUpdate(BaseModel):
    school_year: str = Field(min_length=1, max_length=32)
    timezone: str = Field(min_length=1, max_length=80)
    week_starts_on: Literal["monday", "sunday"]
    bedtime: str = Field(pattern=r"^\d{2}:\d{2}$")
    wake_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    rowing_schedule: list[dict[str, str]] = Field(default_factory=list, max_length=14)
    default_study_duration: int = Field(ge=10, le=180)
    preferred_calendar: str | None = Field(default=None, max_length=255)
    calendar_consent: bool

    _timezone_is_valid = field_validator("timezone")(validate_timezone)
    _clock_is_valid = field_validator("bedtime", "wake_time")(validate_clock)

    @field_validator("rowing_schedule")
    @classmethod
    def validate_rowing_schedule(cls, value: list[dict[str, str]]) -> list[dict[str, str]]:
        valid_days = {
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        }
        for block in value:
            days = [block["day"]] if block.get("day") else block.get("days", "").split(",")
            if not days or any(day.strip() not in valid_days for day in days):
                raise ValueError("Rowing schedule day is invalid")
            start = validate_clock(block.get("start") or block.get("start_time", ""))
            end = validate_clock(block.get("end") or block.get("end_time", ""))
            if time.fromisoformat(start) >= time.fromisoformat(end):
                raise ValueError("Rowing schedule start must be before end")
        return value


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    timezone: str | None = Field(default=None, min_length=1, max_length=80)
    preferred_theme: Literal["light", "dark", "system"] | None = None
    school_year: str | None = Field(default=None, min_length=1, max_length=32)
    week_starts_on: Literal["monday", "sunday"] | None = None
    calendar_consent: bool | None = None

    _timezone_is_valid = field_validator("timezone")(validate_optional_timezone)


class CalendarConnectionSchema(BaseModel):
    connected: bool
    status: str
    provider_email: str | None = None
    permissions: list[str] = Field(default_factory=list)
    last_sync_at: datetime | None = None
    last_error: str | None = None
    reauthentication_required: bool = False


class CalendarSchema(BaseModel):
    id: str
    name: str
    color: str | None = None
    primary: bool = False
    access_role: str
    can_read: bool
    can_write: bool
    selected_for_busy: bool = False
    selected_for_study: bool = False


class CalendarPreferencesSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    study_calendar_id: str | None = Field(default=None, max_length=255)
    busy_calendar_ids: list[str] = Field(default_factory=list, max_length=50)
    publish_automatically: bool = False
    preview_before_publishing: bool = True
    default_reminder_minutes: int = Field(default=10, ge=0, le=40320)
    default_event_color: str = Field(default="#1d4ed8", pattern=r"^#[0-9a-fA-F]{6}$")
    protect_manually_edited_events: bool = True
    preserve_renamed_events: bool = True
    canvai_may_move_study_sessions: bool = True
    allow_weekend_scheduling: bool = True
    include_preparation_notes: bool = True

    @field_validator("busy_calendar_ids")
    @classmethod
    def deduplicate_calendars(cls, value: list[str]) -> list[str]:
        if any(len(item) > 255 for item in value):
            raise ValueError("calendar IDs must be at most 255 characters")
        return list(dict.fromkeys(item for item in value if item))


class StudyCalendarCreate(BaseModel):
    name: str = Field(default="Canvas Sweeper Study", min_length=1, max_length=120)


class BusySyncRequest(BaseModel):
    time_min: datetime
    time_max: datetime

    @field_validator("time_min")
    @classmethod
    def validate_start(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("time_min must include a timezone")
        return value

    @field_validator("time_max")
    @classmethod
    def validate_range(cls, value: datetime, info: ValidationInfo) -> datetime:
        start = info.data.get("time_min")
        if value.utcoffset() is None:
            raise ValueError("time_max must include a timezone")
        if start and value <= start:
            raise ValueError("time_max must be after time_min")
        if start and value - start > timedelta(days=31):
            raise ValueError("busy sync range cannot exceed 31 days")
        return value


class BusyEventSchema(BaseModel):
    calendar_id: str
    provider_event_id: str
    starts_at: datetime
    ends_at: datetime
    all_day: bool
    recurring_event_id: str | None = None


class BusySyncSchema(BaseModel):
    status: Literal["completed", "failed"]
    imported_count: int
    all_day_count: int
    recurring_count: int
    conflicts: int
    free_block_count: int
    travel_conflict_count: int
    overlapping_appointment_count: int
    synced_at: datetime
    events: list[BusyEventSchema]


class StudyCalendarSchema(BaseModel):
    id: str
    name: str
    color: str | None = None
    created: bool = True


class StudySessionPublishSchema(BaseModel):
    session_id: str
    calendar_id: str
    provider_event_id: str
    action: Literal["created", "updated", "unchanged", "protected"]
    published_at: datetime | None = None


class StudySessionPublishRequest(BaseModel):
    confirmation_token: str | None = Field(default=None, max_length=4096)


class StudySessionPreviewSchema(BaseModel):
    session_id: str
    calendar_id: str
    title: str
    starts_at: datetime
    ends_at: datetime
    reminder_minutes: int
    description: str
    confirmation_token: str


class ActionStatusSchema(BaseModel):
    status: str
    message: str
