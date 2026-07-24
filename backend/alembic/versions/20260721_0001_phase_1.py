"""Create Phase 1 foundation tables."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260721_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("time_zone", sa.String(80), nullable=False),
        sa.Column("school_year", sa.String(32), nullable=False),
        sa.Column("week_start", sa.String(16), nullable=False),
        sa.Column("theme", sa.String(16), nullable=False),
        *timestamps(),
    )
    op.create_table(
        "courses",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("short_name", sa.String(40), nullable=False),
        sa.Column("color", sa.String(32), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_courses_user_id", "courses", ["user_id"])
    op.create_table(
        "assignments",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("course_id", sa.String(64), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("assignment_type", sa.String(32), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("grade_weight", sa.Float(), nullable=True),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        sa.Column("actual_minutes", sa.Integer(), nullable=True),
        sa.Column("priority", sa.String(16), nullable=False),
        sa.Column("priority_score", sa.Integer(), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column("urgency", sa.Integer(), nullable=False),
        sa.Column("submission_status", sa.String(32), nullable=False),
        sa.Column("missing", sa.Boolean(), nullable=False),
        sa.Column("completion_state", sa.String(16), nullable=False),
        sa.Column("canvai_explanation", sa.Text(), nullable=False),
        sa.Column("suggested_steps", sa.JSON(), nullable=False),
        sa.Column("canvas_url", sa.String(500), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_assignments_course_id", "assignments", ["course_id"])
    op.create_index("ix_assignments_due_at", "assignments", ["due_at"])
    op.create_table(
        "study_sessions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("assignment_id", sa.String(64), sa.ForeignKey("assignments.id"), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("source", sa.String(24), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_study_sessions_assignment_id", "study_sessions", ["assignment_id"])
    op.create_table(
        "routine_blocks",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("day", sa.String(16), nullable=False),
        sa.Column("activity", sa.String(40), nullable=False),
        sa.Column("start_time", sa.String(5), nullable=False),
        sa.Column("end_time", sa.String(5), nullable=False),
        sa.Column("color", sa.String(24), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_routine_blocks_user_id", "routine_blocks", ["user_id"])
    op.create_table(
        "user_settings",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_user_settings_user_id", "user_settings", ["user_id"], unique=True)
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("time_label", sa.String(20), nullable=False),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("read", sa.Boolean(), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_table(
        "schedule_proposals",
        sa.Column("id", sa.String(96), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("command", sa.String(180), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_schedule_proposals_user_id", "schedule_proposals", ["user_id"])


def downgrade() -> None:
    for table in [
        "schedule_proposals",
        "notifications",
        "user_settings",
        "routine_blocks",
        "study_sessions",
        "assignments",
        "courses",
        "user_profiles",
    ]:
        op.drop_table(table)
