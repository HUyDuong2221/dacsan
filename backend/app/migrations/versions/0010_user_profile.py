"""Hồ sơ người dùng: users.phone (số điện thoại), users.position (đơn vị/chức danh).

Bỏ qua cột đã có (DB mới do create_all tạo theo model hiện tại).

Revision ID: 0010_user_profile
Revises: 0009_posts
Create Date: 2026-11-25
"""
import sqlalchemy as sa
from alembic import op

revision = "0010_user_profile"
down_revision = "0009_posts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    cols = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("users")}
    if "phone" not in cols:
        op.add_column("users", sa.Column("phone", sa.String(30), nullable=False, server_default=""))
    if "position" not in cols:
        op.add_column("users", sa.Column("position", sa.String(200), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("users", "position")
    op.drop_column("users", "phone")
