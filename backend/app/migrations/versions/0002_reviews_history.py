"""Phản biện (reviews) và lịch sử trạng thái bài gửi (submission_history).

Chỉ tạo bảng mới, không sửa bảng/dữ liệu đang có. Bỏ qua nếu bảng đã tồn tại.

Revision ID: 0002_reviews_history
Revises: 0001_baseline
Create Date: 2026-11-23
"""
import sqlalchemy as sa
from alembic import op

revision = "0002_reviews_history"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    have = set(sa.inspect(op.get_bind()).get_table_names())
    if "reviews" not in have:
        op.create_table(
            "reviews",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("submission_id", sa.Integer, sa.ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("reviewer_name", sa.String(200), nullable=False),
            sa.Column("reviewer_email", sa.String(255), nullable=False),
            sa.Column("invited_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("due_date", sa.Date, nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="invited"),
            sa.Column("recommendation", sa.String(20), nullable=True),
            sa.Column("form_data", sa.JSON, nullable=True),
            sa.Column("token_hash", sa.String(64), nullable=False),
            sa.Column("reminder_count", sa.Integer, nullable=False, server_default="0"),
            sa.Column("last_reminded_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_reviews_submission_id", "reviews", ["submission_id"])
        op.create_index("ix_reviews_token_hash", "reviews", ["token_hash"], unique=True)
    if "submission_history" not in have:
        op.create_table(
            "submission_history",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("submission_id", sa.Integer, sa.ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("from_status", sa.String(20), nullable=True),
            sa.Column("to_status", sa.String(20), nullable=False),
            sa.Column("note", sa.Text, nullable=False, server_default=""),
            sa.Column("changed_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_submission_history_submission_id", "submission_history", ["submission_id"])


def downgrade() -> None:
    op.drop_table("submission_history")
    op.drop_table("reviews")
