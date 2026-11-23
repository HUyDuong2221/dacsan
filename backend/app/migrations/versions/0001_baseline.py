"""Mốc: schema có sẵn trước khi dùng Alembic (do init_db() tạo bằng create_all + ALTER thủ công).

Không thay đổi gì, chỉ đánh dấu điểm bắt đầu để DB đang có dữ liệu nâng cấp tiếp được.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-11-23
"""

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
