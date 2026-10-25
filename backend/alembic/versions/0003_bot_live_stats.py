"""bots.live_stats: stats pushed by the bots themselves

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("bots", schema=None) as batch_op:
        batch_op.add_column(sa.Column("live_stats", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("live_stats_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("bots", schema=None) as batch_op:
        batch_op.drop_column("live_stats_at")
        batch_op.drop_column("live_stats")
