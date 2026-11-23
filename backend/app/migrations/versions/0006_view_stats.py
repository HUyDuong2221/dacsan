"""Thống kê lượt xem, đọc PDF, tải PDF theo ngày (view_stats).

Revision ID: 0006_view_stats
Revises: 0005_banners
Create Date: 2026-11-23
"""
import sqlalchemy as sa
from alembic import op

revision = "0006_view_stats"
down_revision = "0005_banners"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "view_stats" in set(sa.inspect(op.get_bind()).get_table_names()):
        return
    op.create_table(
        "view_stats",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("day", sa.Date, nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("target_type", sa.String(10), nullable=False),
        sa.Column("target_id", sa.Integer, nullable=False),
        sa.Column("count", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("day", "kind", "target_type", "target_id", name="uq_view_stats_key"),
    )
    op.create_index("ix_view_stats_day", "view_stats", ["day"])


def downgrade() -> None:
    op.drop_table("view_stats")
