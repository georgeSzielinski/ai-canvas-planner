"""Add Phase 3 Canvas connection and synchronized academic data."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260722_0005"
down_revision: str | None = "20260721_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    with op.batch_alter_table("courses") as batch:
        batch.add_column(sa.Column("canvas_course_id", sa.String(64), nullable=True))
        batch.add_column(sa.Column("course_code", sa.String(255), nullable=True))
        batch.add_column(sa.Column("enrollment_state", sa.String(64), nullable=True))
        batch.add_column(sa.Column("workflow_state", sa.String(64), nullable=True))
        batch.add_column(sa.Column("term_id", sa.String(64), nullable=True))
        batch.add_column(sa.Column("term_name", sa.String(255), nullable=True))
        batch.add_column(sa.Column("start_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("end_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(
            sa.Column("concluded", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch.add_column(sa.Column("favorite", sa.Boolean(), nullable=True))
        batch.add_column(
            sa.Column("selected_for_sync", sa.Boolean(), nullable=False, server_default=sa.true())
        )
        batch.add_column(sa.Column("source_updated_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(
            sa.Column(
                "first_seen_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.current_timestamp(),
            )
        )
        batch.add_column(
            sa.Column(
                "last_seen_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.current_timestamp(),
            )
        )
        batch.add_column(
            sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch.create_index("ix_courses_canvas_course_id", ["canvas_course_id"])
        batch.create_unique_constraint("uq_courses_user_canvas", ["user_id", "canvas_course_id"])

    with op.batch_alter_table("assignments") as batch:
        batch.add_column(sa.Column("user_id", sa.String(64), nullable=True))
        batch.add_column(sa.Column("canvas_assignment_id", sa.String(64), nullable=True))
        batch.add_column(
            sa.Column("category_reason", sa.String(500), nullable=False, server_default="")
        )
        batch.add_column(sa.Column("unlock_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("lock_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(
            sa.Column("submission_types", sa.JSON(), nullable=False, server_default="[]")
        )
        batch.add_column(sa.Column("assignment_group", sa.String(255), nullable=True))
        batch.add_column(sa.Column("grading_type", sa.String(64), nullable=True))
        batch.add_column(
            sa.Column("published", sa.Boolean(), nullable=False, server_default=sa.true())
        )
        batch.add_column(
            sa.Column(
                "omitted_from_final_grade", sa.Boolean(), nullable=False, server_default=sa.false()
            )
        )
        batch.add_column(
            sa.Column("peer_reviews", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch.add_column(sa.Column("canvas_created_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("canvas_updated_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(
            sa.Column(
                "first_seen_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.current_timestamp(),
            )
        )
        batch.add_column(
            sa.Column(
                "last_seen_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.current_timestamp(),
            )
        )
        batch.add_column(sa.Column("source_hash", sa.String(64), nullable=True))
        batch.add_column(
            sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch.add_column(
            sa.Column("deleted", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch.alter_column("due_at", existing_type=sa.DateTime(timezone=True), nullable=True)
        batch.alter_column("points", existing_type=sa.Integer(), type_=sa.Float(), nullable=False)
        batch.create_foreign_key(
            "fk_assignments_user_id", "user_profiles", ["user_id"], ["id"], ondelete="CASCADE"
        )
        batch.create_index("ix_assignments_user_id", ["user_id"])
        batch.create_index("ix_assignments_canvas_assignment_id", ["canvas_assignment_id"])
        batch.create_unique_constraint(
            "uq_assignments_user_canvas", ["user_id", "canvas_assignment_id"]
        )

    op.create_table(
        "canvas_connections",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("hostname", sa.String(255), nullable=False),
        sa.Column("canvas_user_id", sa.String(64), nullable=True),
        sa.Column("canvas_display_name", sa.String(255), nullable=True),
        sa.Column("status", sa.String(64), nullable=False),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_successful_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_attempted_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_status", sa.String(64), nullable=True),
        sa.Column("last_error_code", sa.String(80), nullable=True),
        sa.Column("sync_cursor", sa.String(500), nullable=True),
        sa.Column("include_concluded_courses", sa.Boolean(), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_canvas_connections_user_id", "canvas_connections", ["user_id"], unique=True)

    op.create_table(
        "canvas_sync_runs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("courses_checked", sa.Integer(), nullable=False),
        sa.Column("courses_imported", sa.Integer(), nullable=False),
        sa.Column("assignments_created", sa.Integer(), nullable=False),
        sa.Column("assignments_updated", sa.Integer(), nullable=False),
        sa.Column("assignments_unchanged", sa.Integer(), nullable=False),
        sa.Column("assignments_archived", sa.Integer(), nullable=False),
        sa.Column("submission_states_updated", sa.Integer(), nullable=False),
        sa.Column("course_failures", sa.Integer(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("error_code", sa.String(80), nullable=True),
        *timestamps(),
    )
    op.create_index("ix_canvas_sync_runs_user_id", "canvas_sync_runs", ["user_id"])
    op.create_index("ix_canvas_sync_runs_status", "canvas_sync_runs", ["status"])
    op.create_index(
        "uq_canvas_sync_runs_user_running",
        "canvas_sync_runs",
        ["user_id"],
        unique=True,
        sqlite_where=sa.text("status = 'running'"),
        postgresql_where=sa.text("status = 'running'"),
    )

    op.create_table(
        "canvas_submission_states",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "assignment_id",
            sa.String(64),
            sa.ForeignKey("assignments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("workflow_state", sa.String(64), nullable=True),
        sa.Column("submitted", sa.Boolean(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("grade", sa.String(64), nullable=True),
        sa.Column("late", sa.Boolean(), nullable=False),
        sa.Column("missing", sa.Boolean(), nullable=False),
        sa.Column("excused", sa.Boolean(), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=True),
        sa.Column("seconds_late", sa.Integer(), nullable=True),
        sa.Column("last_source_update_at", sa.DateTime(timezone=True), nullable=True),
        *timestamps(),
    )
    op.create_index("ix_canvas_submission_states_user_id", "canvas_submission_states", ["user_id"])
    op.create_index(
        "ix_canvas_submission_states_assignment_id",
        "canvas_submission_states",
        ["assignment_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("canvas_submission_states")
    op.drop_table("canvas_sync_runs")
    op.drop_table("canvas_connections")

    # Phase 2 cannot represent assignments without due dates. Remove dependent
    # study sessions first, then only the incompatible assignments, before
    # restoring the NOT NULL constraint.
    op.execute(
        sa.text(
            "DELETE FROM study_sessions WHERE assignment_id IN "
            "(SELECT id FROM assignments WHERE due_at IS NULL)"
        )
    )
    op.execute(sa.text("DELETE FROM assignments WHERE due_at IS NULL"))

    with op.batch_alter_table("assignments") as batch:
        batch.drop_constraint("uq_assignments_user_canvas", type_="unique")
        batch.drop_index("ix_assignments_canvas_assignment_id")
        batch.drop_index("ix_assignments_user_id")
        batch.drop_constraint("fk_assignments_user_id", type_="foreignkey")
        batch.alter_column("points", existing_type=sa.Float(), type_=sa.Integer(), nullable=False)
        batch.alter_column("due_at", existing_type=sa.DateTime(timezone=True), nullable=False)
        for column in [
            "deleted",
            "archived",
            "source_hash",
            "last_seen_at",
            "first_seen_at",
            "canvas_updated_at",
            "canvas_created_at",
            "peer_reviews",
            "omitted_from_final_grade",
            "published",
            "grading_type",
            "assignment_group",
            "submission_types",
            "lock_at",
            "unlock_at",
            "category_reason",
            "canvas_assignment_id",
            "user_id",
        ]:
            batch.drop_column(column)

    with op.batch_alter_table("courses") as batch:
        batch.drop_constraint("uq_courses_user_canvas", type_="unique")
        batch.drop_index("ix_courses_canvas_course_id")
        for column in [
            "archived",
            "last_seen_at",
            "first_seen_at",
            "source_updated_at",
            "selected_for_sync",
            "favorite",
            "concluded",
            "end_at",
            "start_at",
            "term_name",
            "term_id",
            "workflow_state",
            "enrollment_state",
            "course_code",
            "canvas_course_id",
        ]:
            batch.drop_column(column)
