import asyncio
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.seed import seed_database
from app.models import Assignment, CanvasConnection, CanvasSubmissionState, CanvasSyncRun, Course
from app.services.canvas_client import (
    CanvasAssignmentPayload,
    CanvasCoursePayload,
    CanvasIdentity,
    CanvasProviderError,
)
from app.services.canvas_sync import CanvasSyncInProgress, synchronize_canvas


class FakeCanvasClient:
    def __init__(self) -> None:
        self.identity = CanvasIdentity.model_validate({"id": 91, "name": "Canvas Student"})
        self.courses = [
            CanvasCoursePayload(
                id=10,
                name="Physics",
                course_code="PHY",
                enrollment_state="active",
                workflow_state="available",
            )
        ]
        self.assignments: dict[int, list[CanvasAssignmentPayload] | Exception] = {
            10: [
                CanvasAssignmentPayload(
                    id=100,
                    course_id=10,
                    name="Problem Set 1",
                    description="<p>Solve <strong>all</strong>.</p><script>bad()</script>",
                    html_url="https://sequoia.instructure.com/courses/10/assignments/100",
                    due_at=None,
                    points_possible=12.5,
                    submission_types=["online_upload"],
                    updated_at=datetime(2026, 7, 1, tzinfo=UTC),
                    submission={
                        "workflow_state": "unsubmitted",
                        "late": True,
                        "missing": False,
                        "attempt": 0,
                    },
                )
            ]
        }

    async def verify(self) -> CanvasIdentity:
        return self.identity

    async def list_courses(self, *, include_concluded: bool) -> list[CanvasCoursePayload]:
        return self.courses

    async def list_assignments(self, course_id: int) -> list[CanvasAssignmentPayload]:
        result = self.assignments[course_id]
        if isinstance(result, Exception):
            raise result
        return result


def database(tmp_path: Path) -> Session:
    engine = create_engine(f"sqlite:///{tmp_path / 'canvas-sync.sqlite3'}")
    Base.metadata.create_all(engine)
    db = Session(engine, expire_on_commit=False)
    seed_database(db)
    return db


def run(coro):  # type: ignore[no-untyped-def]
    return asyncio.run(coro)


def test_sync_is_idempotent_and_preserves_source_semantics(tmp_path: Path) -> None:
    db = database(tmp_path)
    provider = FakeCanvasClient()

    first = run(
        synchronize_canvas(
            db,
            "user-demo",
            provider,
            base_url="https://sequoia.instructure.com",
            include_concluded=False,
        )
    )
    second = run(
        synchronize_canvas(
            db,
            "user-demo",
            provider,
            base_url="https://sequoia.instructure.com",
            include_concluded=False,
        )
    )

    assert first.status == "success"
    assert first.assignments_created == 1
    assert second.assignments_created == 0
    assert second.assignments_unchanged == 1
    assert (
        db.scalar(select(func.count()).select_from(Course).where(Course.canvas_course_id == "10"))
        == 1
    )
    assert (
        db.scalar(
            select(func.count())
            .select_from(Assignment)
            .where(Assignment.canvas_assignment_id == "100")
        )
        == 1
    )
    assignment = db.scalar(select(Assignment).where(Assignment.canvas_assignment_id == "100"))
    assert assignment is not None
    assert assignment.due_at is None
    assert assignment.description == "Solve all."
    assert assignment.assignment_type == "worksheet"
    assert "problem set" in assignment.category_reason.lower()
    assert assignment.points == 12.5
    submission = db.scalar(
        select(CanvasSubmissionState).where(CanvasSubmissionState.assignment_id == assignment.id)
    )
    assert submission is not None
    assert submission.late is True
    assert submission.missing is False
    db.close()


def test_sync_updates_changed_assignment_and_submission(tmp_path: Path) -> None:
    db = database(tmp_path)
    provider = FakeCanvasClient()
    run(
        synchronize_canvas(
            db,
            "user-demo",
            provider,
            base_url="https://sequoia.instructure.com",
            include_concluded=False,
        )
    )
    item = provider.assignments[10]
    assert isinstance(item, list)
    item[0] = item[0].model_copy(
        update={
            "name": "Problem Set 1 revised",
            "submission": item[0].submission.model_copy(
                update={
                    "workflow_state": "submitted",
                    "missing": False,
                    "late": False,
                    "attempt": 1,
                }
            ),
        }
    )

    report = run(
        synchronize_canvas(
            db,
            "user-demo",
            provider,
            base_url="https://sequoia.instructure.com",
            include_concluded=False,
        )
    )

    assert report.assignments_updated == 1
    assert report.submission_states_updated == 1
    assignment = db.scalar(select(Assignment).where(Assignment.canvas_assignment_id == "100"))
    assert assignment is not None and assignment.title.endswith("revised")
    db.close()


def test_sync_clears_submission_state_when_canvas_omits_it(tmp_path: Path) -> None:
    db = database(tmp_path)
    provider = FakeCanvasClient()
    run(
        synchronize_canvas(
            db,
            "user-demo",
            provider,
            base_url="https://sequoia.instructure.com",
            include_concluded=False,
        )
    )
    items = provider.assignments[10]
    assert isinstance(items, list)
    items[0] = items[0].model_copy(update={"submission": None})

    report = run(
        synchronize_canvas(
            db,
            "user-demo",
            provider,
            base_url="https://sequoia.instructure.com",
            include_concluded=False,
        )
    )

    assignment = db.scalar(select(Assignment).where(Assignment.canvas_assignment_id == "100"))
    assert assignment is not None
    assert report.submission_states_updated == 1
    assert (
        db.scalar(
            select(CanvasSubmissionState).where(
                CanvasSubmissionState.assignment_id == assignment.id
            )
        )
        is None
    )
    db.close()


def test_partial_course_failure_preserves_existing_course_assignments(tmp_path: Path) -> None:
    db = database(tmp_path)
    provider = FakeCanvasClient()
    provider.courses.append(
        CanvasCoursePayload(id=20, name="Restricted", enrollment_state="active")
    )
    provider.assignments[20] = CanvasProviderError(
        "permission_denied", "Canvas denied access to the requested resource.", 403
    )

    report = run(
        synchronize_canvas(
            db,
            "user-demo",
            provider,
            base_url="https://sequoia.instructure.com",
            include_concluded=False,
        )
    )

    assert report.status == "partial"
    assert report.course_failures == 1
    assert report.assignments_created == 1
    assert report.warnings
    run_row = db.scalar(select(CanvasSyncRun).order_by(CanvasSyncRun.started_at.desc()))
    assert run_row is not None and run_row.status == "partial"
    db.close()


def test_successful_sync_archives_assignments_no_longer_visible(tmp_path: Path) -> None:
    db = database(tmp_path)
    provider = FakeCanvasClient()
    run(
        synchronize_canvas(
            db,
            "user-demo",
            provider,
            base_url="https://sequoia.instructure.com",
            include_concluded=False,
        )
    )
    provider.assignments[10] = []

    report = run(
        synchronize_canvas(
            db,
            "user-demo",
            provider,
            base_url="https://sequoia.instructure.com",
            include_concluded=False,
        )
    )

    assert report.assignments_archived == 1
    assignment = db.scalar(select(Assignment).where(Assignment.canvas_assignment_id == "100"))
    assert assignment is not None and assignment.archived is True
    db.close()


def test_connection_metadata_never_contains_environment_token(tmp_path: Path) -> None:
    db = database(tmp_path)
    provider = FakeCanvasClient()
    run(
        synchronize_canvas(
            db,
            "user-demo",
            provider,
            base_url="https://sequoia.instructure.com",
            include_concluded=True,
        )
    )
    connection = db.scalar(select(CanvasConnection).where(CanvasConnection.user_id == "user-demo"))
    assert connection is not None
    assert connection.hostname == "sequoia.instructure.com"
    assert connection.canvas_user_id == "91"
    values = " ".join(str(value) for value in vars(connection).values())
    assert "access_token" not in values
    assert "test-token" not in values
    db.close()


def test_database_rejects_two_running_syncs_for_one_user(tmp_path: Path) -> None:
    db = database(tmp_path)
    db.add(
        CanvasSyncRun(
            id="run-one",
            user_id="user-demo",
            status="running",
            started_at=datetime.now(UTC),
        )
    )
    db.commit()
    db.add(
        CanvasSyncRun(
            id="run-two",
            user_id="user-demo",
            status="running",
            started_at=datetime.now(UTC),
        )
    )

    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    db.close()


def test_unexpected_sync_failure_is_finalized(tmp_path: Path) -> None:
    db = database(tmp_path)

    class BrokenClient(FakeCanvasClient):
        async def list_courses(self, *, include_concluded: bool) -> list[CanvasCoursePayload]:
            del include_concluded
            raise RuntimeError("programming error")

    with pytest.raises(RuntimeError, match="programming error"):
        run(
            synchronize_canvas(
                db,
                "user-demo",
                BrokenClient(),
                base_url="https://sequoia.instructure.com",
                include_concluded=False,
            )
        )

    persisted = db.scalar(select(CanvasSyncRun).where(CanvasSyncRun.user_id == "user-demo"))
    assert persisted is not None
    assert persisted.status == "failed"
    assert persisted.completed_at is not None
    assert persisted.error_code == "unexpected_error"
    db.close()


def test_cancelled_sync_is_finalized_as_interrupted(tmp_path: Path) -> None:
    db = database(tmp_path)

    class CancelledClient(FakeCanvasClient):
        async def list_courses(self, *, include_concluded: bool) -> list[CanvasCoursePayload]:
            del include_concluded
            raise asyncio.CancelledError

    with pytest.raises(asyncio.CancelledError):
        run(
            synchronize_canvas(
                db,
                "user-demo",
                CancelledClient(),
                base_url="https://sequoia.instructure.com",
                include_concluded=False,
            )
        )

    persisted = db.scalar(select(CanvasSyncRun).where(CanvasSyncRun.user_id == "user-demo"))
    assert persisted is not None
    assert persisted.status == "interrupted"
    assert persisted.completed_at is not None
    assert persisted.error_code == "request_cancelled"
    db.close()


def test_per_user_lock_rejects_overlapping_sync(tmp_path: Path) -> None:
    db = database(tmp_path)
    started = asyncio.Event()
    release = asyncio.Event()

    class BlockingClient(FakeCanvasClient):
        async def list_courses(self, *, include_concluded: bool) -> list[CanvasCoursePayload]:
            started.set()
            await release.wait()
            return self.courses

    provider = BlockingClient()

    async def scenario() -> None:
        first = asyncio.create_task(
            synchronize_canvas(
                db,
                "user-demo",
                provider,
                base_url="https://sequoia.instructure.com",
                include_concluded=False,
            )
        )
        await started.wait()
        with pytest.raises(CanvasSyncInProgress):
            await synchronize_canvas(
                db,
                "user-demo",
                provider,
                base_url="https://sequoia.instructure.com",
                include_concluded=False,
            )
        release.set()
        await first

    run(scenario())
    db.close()


def test_sync_handles_sqlite_naive_sync_and_submission_timestamps(tmp_path: Path) -> None:
    db = database(tmp_path)
    provider = FakeCanvasClient()
    assignments = provider.assignments[10]
    assert isinstance(assignments, list)
    assignment = assignments[0]
    assert isinstance(assignment, CanvasAssignmentPayload)
    assert assignment.submission is not None
    provider.assignments[10] = [
        assignment.model_copy(
            update={
                "submission": assignment.submission.model_copy(
                    update={"submitted_at": datetime(2026, 7, 22, 20, 0, tzinfo=UTC)}
                )
            }
        )
    ]
    first = run(
        synchronize_canvas(
            db,
            "user-demo",
            provider,
            base_url="https://sequoia.instructure.com",
            include_concluded=False,
        )
    )
    assert first.submission_states_updated == 1
    db.close()

    engine = create_engine(f"sqlite:///{tmp_path / 'canvas-sync.sqlite3'}")
    reloaded = Session(engine, expire_on_commit=False)
    second = run(
        synchronize_canvas(
            reloaded,
            "user-demo",
            provider,
            base_url="https://sequoia.instructure.com",
            include_concluded=False,
        )
    )
    assert second.assignments_unchanged == 1
    assert second.submission_states_updated == 0
    reloaded.close()


def test_sync_recovers_sqlite_naive_stale_run_timestamp(tmp_path: Path) -> None:
    db = database(tmp_path)
    stale = CanvasSyncRun(
        id="stale-run",
        user_id="user-demo",
        status="running",
        started_at=datetime(2020, 7, 22, 20, 0, tzinfo=UTC),
    )
    db.add(stale)
    db.commit()
    db.expire_all()

    report = run(
        synchronize_canvas(
            db,
            "user-demo",
            FakeCanvasClient(),
            base_url="https://sequoia.instructure.com",
            include_concluded=False,
        )
    )

    assert report.status == "success"
    persisted = db.get(CanvasSyncRun, "stale-run")
    assert persisted is not None
    assert persisted.status == "interrupted"
    db.close()
