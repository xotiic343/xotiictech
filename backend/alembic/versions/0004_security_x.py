"""Security X: guild state, consenting members, live logs, bot jobs and member pulls

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-25

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TZ = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "security_guilds",
        sa.Column("guild_id", sa.String(25), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("icon_url", sa.String(500)),
        sa.Column("member_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("state", sa.JSON()),
        sa.Column("updated_at", TZ, nullable=False),
    )
    op.create_index("ix_security_guilds_updated_at", "security_guilds", ["updated_at"])

    op.create_table(
        "security_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.String(25), nullable=False),
        sa.Column("user_id", sa.String(25), nullable=False),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("avatar", sa.String(200)),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=False),
        sa.Column("expires_at", TZ, nullable=False),
        sa.Column("consented_at", TZ, nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("guild_id", "user_id", name="uq_security_members_guild_user"),
    )
    op.create_index("ix_security_members_guild_id", "security_members", ["guild_id"])
    op.create_index("ix_security_members_user_id", "security_members", ["user_id"])
    op.create_index("ix_security_members_revoked", "security_members", ["revoked"])

    op.create_table(
        "security_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.String(25), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("summary", sa.String(300), nullable=False),
        sa.Column("data", sa.JSON()),
        sa.Column("created_at", TZ, nullable=False),
    )
    op.create_index("ix_security_logs_guild_id", "security_logs", ["guild_id"])
    op.create_index("ix_security_logs_type", "security_logs", ["type"])
    op.create_index("ix_security_logs_created_at", "security_logs", ["created_at"])

    op.create_table(
        "security_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("guild_id", sa.String(25), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("result", sa.JSON()),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", TZ, nullable=False),
        sa.Column("claimed_at", TZ),
        sa.Column("finished_at", TZ),
    )
    op.create_index("ix_security_jobs_guild_id", "security_jobs", ["guild_id"])
    op.create_index("ix_security_jobs_status", "security_jobs", ["status"])
    op.create_index("ix_security_jobs_created_at", "security_jobs", ["created_at"])

    op.create_table(
        "security_pulls",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_guild", sa.String(25), nullable=False),
        sa.Column("target_guild", sa.String(25), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="queued"),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("added", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("already", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cursor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.Text()),
        sa.Column("requested_by", sa.String(120), nullable=False),
        sa.Column("created_at", TZ, nullable=False),
        sa.Column("finished_at", TZ),
    )
    op.create_index("ix_security_pulls_source_guild", "security_pulls", ["source_guild"])
    op.create_index("ix_security_pulls_target_guild", "security_pulls", ["target_guild"])
    op.create_index("ix_security_pulls_status", "security_pulls", ["status"])
    op.create_index("ix_security_pulls_created_at", "security_pulls", ["created_at"])


def downgrade() -> None:
    for table in ("security_pulls", "security_jobs", "security_logs", "security_members", "security_guilds"):
        op.drop_table(table)
