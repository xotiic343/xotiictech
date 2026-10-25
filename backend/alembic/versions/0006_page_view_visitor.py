"""page_views.visitor: anonymous daily visitor id for unique-visitor counts and de-duplication

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-25

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("page_views", schema=None) as batch_op:
        batch_op.add_column(sa.Column("visitor", sa.String(32), nullable=True))
        batch_op.create_index("ix_page_views_visitor", ["visitor"])


def downgrade() -> None:
    with op.batch_alter_table("page_views", schema=None) as batch_op:
        batch_op.drop_index("ix_page_views_visitor")
        batch_op.drop_column("visitor")
