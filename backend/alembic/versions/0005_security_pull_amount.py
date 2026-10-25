"""security_pulls.max_members: pull a chosen number of members instead of everyone

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-25

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("security_pulls", schema=None) as batch_op:
        batch_op.add_column(sa.Column("max_members", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("security_pulls", schema=None) as batch_op:
        batch_op.drop_column("max_members")
