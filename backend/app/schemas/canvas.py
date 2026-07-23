from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CanvasConnectionSchema(BaseModel):
    connected: bool
    configured: bool
    status: str
    canvas_display_name: str | None = None
    canvas_user_id: str | None = None
    hostname: str | None = None
    last_verified_at: datetime | None = None
    last_successful_sync_at: datetime | None = None
    last_attempted_sync_at: datetime | None = None
    last_sync_status: str | None = None
    last_error_code: str | None = None
    include_concluded_courses: bool = False
    data_stale: bool = True


class CanvasSyncRequest(BaseModel):
    include_concluded: bool = False


class CanvasSyncReportSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: Literal["running", "success", "partial", "failed", "interrupted"] | str
    courses_checked: int
    courses_imported: int
    assignments_created: int
    assignments_updated: int
    assignments_unchanged: int
    assignments_archived: int
    submission_states_updated: int
    course_failures: int
    warnings: list[str]
    started_at: datetime
    completed_at: datetime | None
    error_code: str | None


class CanvasCourseSchema(BaseModel):
    id: str
    canvas_course_id: str
    name: str
    course_code: str | None
    enrollment_state: str | None
    workflow_state: str | None
    term_name: str | None
    start_at: datetime | None
    end_at: datetime | None
    concluded: bool
    favorite: bool | None
    selected_for_sync: bool
    archived: bool
    assignment_count: int
    last_seen_at: datetime


class CanvasCourseSelection(BaseModel):
    selected_for_sync: bool


class CanvasAssignmentSchema(BaseModel):
    id: str
    canvas_assignment_id: str
    course_id: str
    course_name: str
    title: str
    description: str
    category: str
    category_reason: str
    canvas_url: str | None
    due_at: datetime | None
    unlock_at: datetime | None
    lock_at: datetime | None
    points_possible: float | None
    submission_types: list[str]
    assignment_group: str | None
    grading_type: str | None
    published: bool
    omitted_from_final_grade: bool
    peer_reviews: bool
    workflow_state: str | None
    submission_status: str
    submitted_at: datetime | None
    graded_at: datetime | None
    score: float | None
    grade: str | None
    late: bool
    missing: bool
    excused: bool
    attempt_count: int | None
    seconds_late: int | None
    completed: bool
    locked: bool
    archived: bool
    concluded_course: bool
    canvas_created_at: datetime | None
    canvas_updated_at: datetime | None
    first_seen_at: datetime
    last_seen_at: datetime


class CanvasAssignmentPage(BaseModel):
    items: list[CanvasAssignmentSchema]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total: int = Field(ge=0)
