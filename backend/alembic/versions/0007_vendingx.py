"""vendingx stock tables

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-30
"""

from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vending_stock_types",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("key", sa.String(80), unique=True, index=True, nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String(300), server_default=""),
        sa.Column("is_premium", sa.Boolean, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer, server_default="0"),
    )
    op.create_table(
        "vending_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("stock_key", sa.String(80), index=True, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("dispensed", sa.Boolean, server_default=sa.text("false"), index=True),
        sa.Column("dispensed_to", sa.String(80)),
        sa.Column("dispensed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "vending_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.String(80), index=True, nullable=False),
        sa.Column("username", sa.String(120), server_default=""),
        sa.Column("stock_key", sa.String(80), nullable=False),
        sa.Column("stock_name", sa.String(120), nullable=False),
        sa.Column("source", sa.String(20), server_default="WEB"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("vending_log")
    op.drop_table("vending_items")
    op.drop_table("vending_stock_types")
