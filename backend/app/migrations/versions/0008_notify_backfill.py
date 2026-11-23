"""Thư báo số mới chuyển sang tự động khi công bố: đánh dấu các số ĐÃ công bố là đã báo.

Nếu không, lần sửa (hoặc bỏ công bố rồi công bố lại) một số cũ sẽ gửi thư "số mới" cho số đã phát hành từ lâu.
Chỉ ghi Issue.notified_at cho số đang công bố mà chưa có giá trị; không đổi dữ liệu khác.

Revision ID: 0008_notify_backfill
Revises: 0007_email
Create Date: 2026-11-23
"""
import sqlalchemy as sa
from alembic import op

revision = "0008_notify_backfill"
down_revision = "0007_email"
branch_labels = None
depends_on = None


def upgrade() -> None:
    issues = sa.table("issues", sa.column("published", sa.Boolean), sa.column("notified_at", sa.DateTime(timezone=True)))
    op.get_bind().execute(issues.update().where(issues.c.published.is_(True), issues.c.notified_at.is_(None))
                          .values(notified_at=sa.func.now()))


def downgrade() -> None:
    pass  # không phân biệt được giá trị do migration này ghi
