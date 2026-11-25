"""Ảnh bìa cho bài viết: posts.cover_url.

Revision ID: 0013_post_cover
Revises: 0012_spotlights
Create Date: 2026-11-25
"""
import sqlalchemy as sa
from alembic import op

revision = "0013_post_cover"
down_revision = "0012_spotlights"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "cover_url" not in {c["name"] for c in sa.inspect(op.get_bind()).get_columns("posts")}:
        op.add_column("posts", sa.Column("cover_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("posts", "cover_url")
