"""vendingx: stock type icons, item origin

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-31
"""

from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("vending_stock_types") as batch_op:
        batch_op.add_column(sa.Column("icon_url", sa.String(length=1000), nullable=True))
    with op.batch_alter_table("vending_items") as batch_op:
        batch_op.add_column(sa.Column("origin", sa.String(length=10), nullable=False, server_default="bot"))


def downgrade() -> None:
    with op.batch_alter_table("vending_items") as batch_op:
        batch_op.drop_column("origin")
    with op.batch_alter_table("vending_stock_types") as batch_op:
        batch_op.drop_column("icon_url")
