"""Bài viết độc lập (posts): tạo từ công cụ "Tạo bài từ PDF", hiển thị tại /bai-viet/<slug>.

Chỉ tạo bảng mới, không đụng dữ liệu cũ.

Revision ID: 0009_posts
Revises: 0008_notify_backfill
Create Date: 2026-11-25
"""
import sqlalchemy as sa
from alembic import op

revision = "0009_posts"
down_revision = "0008_notify_backfill"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "posts" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "posts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("title", sa.String(600), nullable=False),
        sa.Column("author", sa.String(300), nullable=False, server_default=""),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("published_at", sa.Date, nullable=True),
        sa.Column("published", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_posts_slug", "posts", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_posts_slug", table_name="posts")
    op.drop_table("posts")
