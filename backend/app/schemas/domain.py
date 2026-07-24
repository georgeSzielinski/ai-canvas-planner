from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.phase2 import validate_timezone


class CourseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    short_name: str
    color: str


class AssignmentAnalysis(BaseModel):
    difficulty: int = Field(ge=1, le=5)
    urgency: int = Field(ge=1, le=5)
    priority_score: int = Field(ge=0, le=100)
    explanation: str
    suggested_steps: list[str]


class AssignmentSchema(BaseModel):
    id: str
    course_id: str
    title: str
    description: str
    type: str
    due_at: datetime | None
    points: float
    grade_weight: float | None = None
    estimated_minutes: int
    actual_minutes: int | None = None
    priority: str
    submission_status: str
    missing: bool
    completion_state: str
    scheduled_session_ids: list[str]
    analysis: AssignmentAnalysis
    canvas_url: str


class AssignmentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=240)
    estimated_minutes: int | None = Field(default=None, ge=10, le=600)
    completion_state: Literal["open", "completed"] | None = None
    submission_status: Literal["not_started", "in_progress", "submitted", "graded"] | None = None
    missing: bool | None = None


class StudySessionSchema(BaseModel):
    id: str
    assignment_id: str
    title: str
    start_at: datetime
    duration_minutes: int
    status: str
    source: str


class RoutineBlockSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    day: str
    activity: str
    start_time: str
    end_time: str
    color: str


class NotificationSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    body: str
    time_label: str
    kind: str
    read: bool


class UserProfileSchema(BaseModel):
    id: str
    display_name: str = Field(min_length=1, max_length=120)
    time_zone: str
    school_year: str
    week_start: Literal["monday", "sunday"]
    theme: Literal["light", "dark", "system"]

    _timezone_is_valid = field_validator("time_zone")(validate_timezone)


class StudyPreferencesSchema(BaseModel):
    earliest_time: str
    latest_time: str
    preferred_session_minutes: int = Field(ge=10, le=180)
    max_session_minutes: int = Field(ge=10, le=240)
    break_minutes: int = Field(ge=0, le=60)
    weekday_workload_minutes: int = Field(ge=0, le=600)
    weekend_workload_minutes: int = Field(ge=0, le=600)
    minimum_free_minutes: int = Field(ge=0, le=600)
    emergency_buffer_minutes: int = Field(ge=0, le=180)
    study_before_school: bool
    study_at_lunch: bool
    study_after_rowing: bool
    friday_night: str
    saturday_night: str
    sunday_night: str


class SleepPreferencesSchema(BaseModel):
    current_bedtime: str
    target_bedtime: str
    wake_time: str
    gradual_adjustment: bool
    protect_sleep: bool
    prevent_late_study: bool
    athlete_recovery_mode: bool
    avoid_intense_after_training: bool


class SubjectPreferenceSchema(BaseModel):
    course_id: str
    difficulty: int = Field(ge=1, le=5)
    confidence: int = Field(ge=1, le=5)
    importance: int = Field(ge=1, le=5)
    typical_minutes: int = Field(ge=5, le=600)
    test_difficulty: int = Field(ge=1, le=5)
    extra_time_multiplier: float = Field(ge=1, le=3)


class CalendarPreferencesSchema(BaseModel):
    study_calendar: str
    busy_calendars: list[str]
    automatic_publishing: bool
    preview_before_publishing: bool
    notifications: bool
    canvai_may_move_own_events: bool
    preserve_manual_edits: bool


class AISettingsSchema(BaseModel):
    enabled: bool
    provider: str
    analysis_depth: Literal["concise", "balanced", "detailed"]
    show_reasoning: bool
    automatic_duration: bool
    automatic_classification: bool
    use_completion_history: bool
    ask_before_major_changes: bool
    estimate_feedback: bool


class AssignmentRulesSchema(BaseModel):
    tests_extra_priority: bool
    start_essays_early: bool
    split_long_assignments: bool
    create_project_milestones: bool
    missing_overrides: bool
    delay_low_value_when_overloaded: bool
    allow_same_course_sessions: bool
    include_prep_instructions: bool
    rebuild_missed_schedules: bool
    keep_sunday_light: bool
    protect_daily_free_time: bool


class AppSettingsSchema(BaseModel):
    profile: UserProfileSchema
    study: StudyPreferencesSchema
    sleep: SleepPreferencesSchema
    subjects: list[SubjectPreferenceSchema]
    calendar: CalendarPreferencesSchema
    ai: AISettingsSchema
    rules: AssignmentRulesSchema


class WorkloadSchema(BaseModel):
    date: datetime
    day: str
    planned_minutes: int
    capacity_minutes: int
    deadline_pressure: int
    tests: int
    writing_heavy: bool


class InsightMetricSchema(BaseModel):
    id: str
    label: str
    value: str
    change: str
    explanation: str
    adjustment: str


class ConnectionSchema(BaseModel):
    provider: str
    status: str
    last_sync: str | None = None
    permissions: list[str]


class WorkspaceBootstrapSchema(BaseModel):
    courses: list[CourseSchema]
    assignments: list[AssignmentSchema]
    sessions: list[StudySessionSchema]
    routine: list[RoutineBlockSchema]
    notifications: list[NotificationSchema]
    workload: list[WorkloadSchema]
    settings: AppSettingsSchema


class CanvaiProposalRequest(BaseModel):
    command: str = Field(min_length=3, max_length=180)


class ScheduleChangeSchema(BaseModel):
    id: str
    kind: Literal["move", "add", "remove", "protect"]
    label: str
    before: str | None = None
    after: str | None = None


class ScheduleProposalSchema(BaseModel):
    id: str
    command: str
    summary: str
    reasoning: str
    changes: list[ScheduleChangeSchema]
    status: Literal["preview", "applied", "dismissed"] = "preview"


class StatusSchema(BaseModel):
    status: str
    service: str
    database: str | None = None
