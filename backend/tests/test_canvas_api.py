from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.canvas_routes import get_canvas_client
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.main import app
from app.models import Assignment, Course, UserProfile
from app.services.canvas_client import (
    CanvasAssignmentPayload,
    CanvasCoursePayload,
    CanvasIdentity,
    CanvasProviderError,
)


class ApiCanvasClient:
    def __init__(self) -> None:
        self.error: CanvasProviderError | None = None
        self.assignments: list[CanvasAssignmentPayload] | None = None

    async def verify(self) -> CanvasIdentity:
        if self.error:
            raise self.error
        return CanvasIdentity.model_validate({"id": 44, "name": "API Student"})

    async def list_courses(self, *, include_concluded: bool) -> list[CanvasCoursePayload]:
        courses = [
            CanvasCoursePayload(
                id=30,
                name="API Course",
                course_code="API-101",
                enrollment_state="active",
                workflow_state="available",
            )
        ]
        if include_concluded:
            courses.append(
                CanvasCoursePayload(
                    id=31,
                    name="Past Course",
                    enrollment_state="completed",
                    workflow_state="completed",
                )
            )
        return courses

    async def list_assignments(self, course_id: int) -> list[CanvasAssignmentPayload]:
        if course_id == 31:
            return []
        if self.assignments is not None:
            return self.assignments
        return [
            CanvasAssignmentPayload(
                id=300,
                course_id=30,
                name="API Quiz",
                html_url="https://sequoia.instructure.com/courses/30/assignments/300",
                due_at=None,
                points_possible=10,
                submission_types=["online_quiz"],
                submission={
                    "workflow_state": "unsubmitted",
                    "missing": True,
                    "late": False,
                },
                updated_at=datetime(2026, 7, 20, tzinfo=UTC),
            )
        ]


def configure(provider: ApiCanvasClient) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        canvas_base_url="https://sequoia.instructure.com",
        canvas_access_token="fake-automated-test-token",
    )
    app.dependency_overrides[get_canvas_client] = lambda: provider


def test_canvas_endpoints_require_authentication(anonymous_client: TestClient) -> None:
    for method, path in [
        ("get", "/api/v1/canvas/status"),
        ("post", "/api/v1/canvas/verify"),
        ("post", "/api/v1/canvas/sync"),
        ("get", "/api/v1/canvas/courses"),
        ("get", "/api/v1/canvas/assignments"),
    ]:
        assert getattr(anonymous_client, method)(path).status_code == 401


def test_canvas_status_reports_not_configured_without_token(client: TestClient) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        canvas_base_url="https://sequoia.instructure.com", canvas_access_token=""
    )
    response = client.get("/api/v1/canvas/status")
    assert response.status_code == 200
    assert response.json()["status"] == "not_configured"
    assert response.json()["connected"] is False
    assert "token" not in response.text.lower()


def test_verify_sync_list_filter_and_course_selection(client: TestClient) -> None:
    provider = ApiCanvasClient()
    configure(provider)

    verified = client.post("/api/v1/canvas/verify")
    assert verified.status_code == 200
    assert verified.json()["connected"] is True
    assert verified.json()["canvas_display_name"] == "API Student"
    assert verified.json()["hostname"] == "sequoia.instructure.com"

    synced = client.post("/api/v1/canvas/sync", json={"include_concluded": True})
    assert synced.status_code == 200
    assert synced.json()["status"] == "success"
    assert synced.json()["courses_imported"] == 2
    assert synced.json()["assignments_created"] == 1
    status = client.get("/api/v1/canvas/status")
    assert status.status_code == 200
    assert status.json()["data_stale"] is False

    courses = client.get("/api/v1/canvas/courses?include_concluded=true").json()
    assert [item["name"] for item in courses] == ["API Course", "Past Course"]
    assert courses[0]["assignment_count"] == 1

    assignments = client.get("/api/v1/canvas/assignments?missing=true&no_due_date=true").json()
    assert assignments["total"] == 1
    assert assignments["items"][0]["category"] == "quiz"
    assert assignments["items"][0]["due_at"] is None
    assert assignments["items"][0]["missing"] is True

    course_id = courses[0]["id"]
    changed = client.patch(f"/api/v1/canvas/courses/{course_id}", json={"selected_for_sync": False})
    assert changed.status_code == 200
    assert changed.json()["selected_for_sync"] is False

    latest = client.get("/api/v1/canvas/sync/latest")
    assert latest.status_code == 200
    assert latest.json()["status"] == "success"


def test_verify_returns_sanitized_invalid_token_error_and_updates_status(
    client: TestClient,
) -> None:
    provider = ApiCanvasClient()
    provider.error = CanvasProviderError(
        "invalid_token", "The Canvas credential is invalid or expired. Replace it and retry.", 401
    )
    configure(provider)

    response = client.post("/api/v1/canvas/verify")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"
    assert "fake-automated-test-token" not in response.text
    status = client.get("/api/v1/canvas/status").json()
    assert status["status"] == "reconnect_required"
    assert status["last_error_code"] == "invalid_token"


def test_canvas_assignment_detail_and_user_isolation(client: TestClient) -> None:
    provider = ApiCanvasClient()
    configure(provider)
    assert client.post("/api/v1/canvas/sync", json={}).status_code == 200
    item = client.get("/api/v1/canvas/assignments").json()["items"][0]
    detail = client.get(f"/api/v1/canvas/assignments/{item['id']}")
    assert detail.status_code == 200
    assert detail.json()["id"] == item["id"]

    dependency = app.dependency_overrides[get_db]
    generator = dependency()
    database = next(generator)
    other = UserProfile(
        id="other-user",
        display_name="Other",
        time_zone="UTC",
        school_year="Senior",
    )
    database.add(other)
    database.flush()
    other_course = Course(
        id="other-course",
        user_id=other.id,
        name="Private",
        short_name="Private",
        color="gray",
        canvas_course_id="999",
    )
    database.add(other_course)
    database.flush()
    database.add(
        Assignment(
            id="other-assignment",
            user_id=other.id,
            course_id=other_course.id,
            canvas_assignment_id="9999",
            title="Other user's private assignment",
            description="private",
            assignment_type="other",
            category_reason="none",
            due_at=None,
            points=0,
            estimated_minutes=0,
            priority="low",
            priority_score=0,
            difficulty=1,
            urgency=1,
            submission_status="not_started",
            missing=False,
            completion_state="open",
            canvai_explanation="none",
            suggested_steps=[],
            canvas_url="",
        )
    )
    database.commit()
    generator.close()

    listing = client.get("/api/v1/canvas/assignments").text
    assert "Other user's private assignment" not in listing
    assert client.get("/api/v1/canvas/assignments/other-assignment").status_code == 404


def test_canvas_assignment_endpoints_normalize_sqlite_datetimes(client: TestClient) -> None:
    provider = ApiCanvasClient()
    provider.assignments = [
        CanvasAssignmentPayload.model_validate(
            {
                "id": 300,
                "course_id": 30,
                "name": "Timezone assignment",
                "due_at": "2026-07-22T20:00:00Z",
                "unlock_at": "2026-07-22T13:00:00-07:00",
                "lock_at": "2020-07-22T13:00:00-07:00",
                "submission": {
                    "workflow_state": "graded",
                    "submitted_at": "2026-07-22T12:30:00-07:00",
                    "graded_at": "2026-07-22T20:00:00Z",
                    "updated_at": "2026-07-22T13:15:00-07:00",
                },
            }
        ),
        CanvasAssignmentPayload(
            id=301,
            course_id=30,
            name="Nullable dates",
            due_at=None,
            unlock_at=None,
            lock_at=None,
        ),
    ]
    configure(provider)
    assert client.post("/api/v1/canvas/sync", json={}).status_code == 200

    dependency = app.dependency_overrides[get_db]
    generator = dependency()
    database = next(generator)
    stored = database.scalar(select(Assignment).where(Assignment.canvas_assignment_id == "300"))
    assert stored is not None
    assert stored.due_at is not None and stored.due_at.tzinfo is None
    assert stored.unlock_at is not None and stored.unlock_at.tzinfo is None
    assert stored.lock_at is not None and stored.lock_at.tzinfo is None
    generator.close()

    listing = client.get("/api/v1/canvas/assignments?page=1&page_size=100")
    assert listing.status_code == 200
    items = {item["canvas_assignment_id"]: item for item in listing.json()["items"]}
    assert items["300"]["due_at"] == "2026-07-22T20:00:00Z"
    assert items["300"]["unlock_at"] == "2026-07-22T20:00:00Z"
    assert items["300"]["locked"] is True
    assert items["301"]["due_at"] is None
    assert items["301"]["unlock_at"] is None
    assert items["301"]["lock_at"] is None

    detail = client.get(f"/api/v1/canvas/assignments/{items['300']['id']}")
    assert detail.status_code == 200
    assert detail.json()["submitted_at"] == "2026-07-22T19:30:00Z"
    assert detail.json()["graded_at"] == "2026-07-22T20:00:00Z"


def test_course_filters_are_deterministically_sorted(client: TestClient) -> None:
    provider = ApiCanvasClient()
    configure(provider)
    client.post("/api/v1/canvas/sync", json={"include_concluded": True})
    names = [
        item["name"] for item in client.get("/api/v1/canvas/courses?include_concluded=true").json()
    ]
    assert names == sorted(names, key=str.casefold)
