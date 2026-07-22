"""Add OAuth requester fingerprints for distributed rate limiting.

Revision ID: 20260721_0004
Revises: 20260721_0003
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260721_0004"
down_revision: str | None = "20260721_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "oauth_state_locks",
        sa.Column("id", sa.Integer(), primary_key=True),
    )
    op.execute("INSERT INTO oauth_state_locks (id) VALUES (1)")
    op.add_column(
        "oauth_states",
        sa.Column("requester_hash", sa.String(64), nullable=True),
    )
    op.execute("UPDATE oauth_states SET requester_hash = 'legacy' WHERE requester_hash IS NULL")
    with op.batch_alter_table("oauth_states") as batch_op:
        batch_op.alter_column("requester_hash", existing_type=sa.String(64), nullable=False)
        batch_op.create_index("ix_oauth_states_requester_hash", ["requester_hash"])


def downgrade() -> None:
    with op.batch_alter_table("oauth_states") as batch_op:
        batch_op.drop_index("ix_oauth_states_requester_hash")
        batch_op.drop_column("requester_hash")
    op.drop_table("oauth_state_locks")
