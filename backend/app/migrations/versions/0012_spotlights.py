"""Quản lý Tiêu điểm: bảng spotlights (số đặc san, hoạt động, trang nội dung, bài viết) và chuyển các số đang tick "Tiêu điểm" sang bảng mới.

Revision ID: 0012_spotlights
Revises: 0011_clean_toc_titles
Create Date: 2026-11-25
"""
import sqlalchemy as sa
from alembic import op

revision = "0012_spotlights"
down_revision = "0011_clean_toc_titles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "spotlights" in set(sa.inspect(bind).get_table_names()):
        return
    op.create_table(
        "spotlights",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("issue_id", sa.Integer, nullable=True),
        sa.Column("activity_id", sa.Integer, nullable=True),
        sa.Column("page_id", sa.Integer, nullable=True),
        sa.Column("post_id", sa.Integer, nullable=True),
        sa.Column("title", sa.String(600), nullable=False, server_default=""),
        sa.Column("excerpt", sa.String(1000), nullable=False, server_default=""),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("published", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # các số đã tick "Tiêu điểm" (mới nhất trước) thành các dòng đầu tiên
    rows = bind.execute(sa.text(
        "SELECT id FROM issues WHERE featured = :t ORDER BY published_at DESC, number DESC"), {"t": True}).all()
    for n, (iid,) in enumerate(rows):
        bind.execute(sa.text("INSERT INTO spotlights (issue_id, sort_order) VALUES (:i, :n)"), {"i": iid, "n": n})


def downgrade() -> None:
    op.drop_table("spotlights")
