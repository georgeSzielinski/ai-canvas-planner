"""Add Phase 2 accounts, sessions, and Google Calendar persistence."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260721_0002"
down_revision: str | None = "20260721_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    with op.batch_alter_table("user_profiles") as batch:
        batch.add_column(sa.Column("google_id", sa.String(255), nullable=True))
        batch.add_column(sa.Column("email", sa.String(320), nullable=True))
        batch.add_column(sa.Column("profile_photo", sa.String(1000), nullable=True))
        batch.add_column(
            sa.Column(
                "onboarding_complete", sa.Boolean(), nullable=False, server_default=sa.false()
            )
        )
        batch.add_column(sa.Column("bedtime", sa.String(5), nullable=True))
        batch.add_column(sa.Column("wake_time", sa.String(5), nullable=True))
        batch.add_column(
            sa.Column("rowing_schedule", sa.JSON(), nullable=False, server_default="[]")
        )
        batch.add_column(
            sa.Column("default_study_duration", sa.Integer(), nullable=False, server_default="45")
        )
        batch.add_column(sa.Column("preferred_calendar", sa.String(255), nullable=True))
        batch.add_column(
            sa.Column("calendar_consent", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch.create_index("ix_user_profiles_google_id", ["google_id"], unique=True)
        batch.create_index("ix_user_profiles_email", ["email"], unique=True)

    with op.batch_alter_table("study_sessions") as batch:
        batch.add_column(sa.Column("calendar_id", sa.String(255), nullable=True))
        batch.add_column(sa.Column("provider_event_id", sa.String(255), nullable=True))
        batch.add_column(sa.Column("provider_etag", sa.String(255), nullable=True))
        batch.add_column(sa.Column("last_published_hash", sa.String(64), nullable=True))
        batch.add_column(sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(
            sa.Column("manually_edited", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch.create_index("ix_study_sessions_provider_event_id", ["provider_event_id"])

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("csrf_token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("remember_login", sa.Boolean(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        *timestamps(),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_auth_sessions_token_hash", "auth_sessions", ["token_hash"], unique=True)
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"])

    op.create_table(
        "calendar_connections",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_account_id", sa.String(255), nullable=True),
        sa.Column("provider_email", sa.String(320), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("scopes", sa.JSON(), nullable=False),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(500), nullable=True),
        sa.Column("study_calendar_id", sa.String(255), nullable=True),
        *timestamps(),
    )
    op.create_index(
        "ix_calendar_connections_user_id", "calendar_connections", ["user_id"], unique=True
    )

    op.create_table(
        "oauth_credentials",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "connection_id",
            sa.String(64),
            sa.ForeignKey("calendar_connections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("encrypted_access_token", sa.Text(), nullable=False),
        sa.Column("encrypted_refresh_token", sa.Text(), nullable=True),
        sa.Column("token_type", sa.String(32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scope", sa.Text(), nullable=False),
        sa.Column("key_version", sa.Integer(), nullable=False),
        *timestamps(),
    )
    op.create_index(
        "ix_oauth_credentials_connection_id",
        "oauth_credentials",
        ["connection_id"],
        unique=True,
    )

    op.create_table(
        "calendar_preferences",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("study_calendar_id", sa.String(255), nullable=True),
        sa.Column("busy_calendar_ids", sa.JSON(), nullable=False),
        sa.Column("publish_automatically", sa.Boolean(), nullable=False),
        sa.Column("preview_before_publishing", sa.Boolean(), nullable=False),
        sa.Column("default_reminder_minutes", sa.Integer(), nullable=False),
        sa.Column("default_event_color", sa.String(32), nullable=False),
        sa.Column("protect_manually_edited_events", sa.Boolean(), nullable=False),
        sa.Column("preserve_renamed_events", sa.Boolean(), nullable=False),
        sa.Column("canvai_may_move_study_sessions", sa.Boolean(), nullable=False),
        sa.Column("allow_weekend_scheduling", sa.Boolean(), nullable=False),
        sa.Column("include_preparation_notes", sa.Boolean(), nullable=False),
        *timestamps(),
    )
    op.create_index(
        "ix_calendar_preferences_user_id", "calendar_preferences", ["user_id"], unique=True
    )

    op.create_table(
        "busy_event_cache",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "connection_id",
            sa.String(64),
            sa.ForeignKey("calendar_connections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("calendar_id", sa.String(255), nullable=False),
        sa.Column("provider_event_id", sa.String(255), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("all_day", sa.Boolean(), nullable=False),
        sa.Column("recurring_event_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.UniqueConstraint(
            "user_id", "calendar_id", "provider_event_id", name="uq_busy_event_provider"
        ),
        *timestamps(),
    )
    op.create_index("ix_busy_event_cache_user_id", "busy_event_cache", ["user_id"])
    op.create_index("ix_busy_event_cache_connection_id", "busy_event_cache", ["connection_id"])
    op.create_index("ix_busy_event_cache_calendar_id", "busy_event_cache", ["calendar_id"])
    op.create_index("ix_busy_event_cache_starts_at", "busy_event_cache", ["starts_at"])
    op.create_index("ix_busy_event_cache_ends_at", "busy_event_cache", ["ends_at"])

    op.create_table(
        "calendar_sync_history",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("user_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "connection_id",
            sa.String(64),
            sa.ForeignKey("calendar_connections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("events_imported", sa.Integer(), nullable=False),
        sa.Column("error_code", sa.String(80), nullable=True),
        sa.Column("error_message", sa.String(500), nullable=True),
        *timestamps(),
    )
    op.create_index("ix_calendar_sync_history_user_id", "calendar_sync_history", ["user_id"])
    op.create_index(
        "ix_calendar_sync_history_connection_id", "calendar_sync_history", ["connection_id"]
    )


def downgrade() -> None:
    for table in [
        "calendar_sync_history",
        "busy_event_cache",
        "calendar_preferences",
        "oauth_credentials",
        "calendar_connections",
        "auth_sessions",
    ]:
        op.drop_table(table)

    with op.batch_alter_table("study_sessions") as batch:
        batch.drop_index("ix_study_sessions_provider_event_id")
        for column in [
            "manually_edited",
            "published_at",
            "last_published_hash",
            "provider_etag",
            "provider_event_id",
            "calendar_id",
        ]:
            batch.drop_column(column)

    with op.batch_alter_table("user_profiles") as batch:
        batch.drop_index("ix_user_profiles_email")
        batch.drop_index("ix_user_profiles_google_id")
        for column in [
            "calendar_consent",
            "preferred_calendar",
            "default_study_duration",
            "rowing_schedule",
            "wake_time",
            "bedtime",
            "onboarding_complete",
            "profile_photo",
            "email",
            "google_id",
        ]:
            batch.drop_column(column)
