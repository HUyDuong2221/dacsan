"""Email: hộp thư đi, tài khoản chờ duyệt, xác nhận đăng ký nhận tin, đánh dấu đã gửi thư báo số mới.

- email_outbox (bảng mới)
- users.pending           : tự đăng ký, chờ quản trị viên duyệt (tài khoản cũ = false)
- subscribers.confirmed   : xác nhận hai bước (người đăng ký từ trước = true, giữ nguyên)
- subscribers.token       : link xác nhận / hủy đăng ký (sinh cho mọi dòng cũ)
- issues.notified_at      : thời điểm đã gửi thư báo số mới

Bỏ qua cột/bảng đã có (DB mới do create_all tạo theo model hiện tại).

Revision ID: 0007_email
Revises: 0006_view_stats
Create Date: 2026-11-23
"""
import secrets

import sqlalchemy as sa
from alembic import op

revision = "0007_email"
down_revision = "0006_view_stats"
branch_labels = None
depends_on = None


def _cols(insp, table: str) -> set[str]:
    return {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "email_outbox" not in set(insp.get_table_names()):
        op.create_table(
            "email_outbox",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("to_email", sa.String(255), nullable=False),
            sa.Column("subject", sa.String(300), nullable=False),
            sa.Column("body_text", sa.Text, nullable=False),
            sa.Column("body_html", sa.Text, nullable=True),
            sa.Column("kind", sa.String(30), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("error", sa.String(500), nullable=True),
            sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
            sa.Column("meta", sa.JSON, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        )
        for col in ("to_email", "kind", "status", "created_at"):
            op.create_index(f"ix_email_outbox_{col}", "email_outbox", [col])

    if "pending" not in _cols(insp, "users"):
        op.add_column("users", sa.Column("pending", sa.Boolean, nullable=False, server_default=sa.false()))
    if "notified_at" not in _cols(insp, "issues"):
        op.add_column("issues", sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True))

    sub_cols = _cols(insp, "subscribers")
    if "confirmed" not in sub_cols:
        # người đăng ký trước khi có xác nhận hai bước: giữ nguyên là đã xác nhận
        op.add_column("subscribers", sa.Column("confirmed", sa.Boolean, nullable=False, server_default=sa.true()))
        if bind.dialect.name == "postgresql":  # từ nay dòng mới mặc định chưa xác nhận (SQLite không đổi default được, ORM luôn ghi rõ)
            op.alter_column("subscribers", "confirmed", server_default=sa.false())
    if "token" not in sub_cols:
        op.add_column("subscribers", sa.Column("token", sa.String(64), nullable=True))
        subs = sa.table("subscribers", sa.column("id", sa.Integer), sa.column("token", sa.String))
        for (sid,) in bind.execute(sa.select(subs.c.id).where(subs.c.token.is_(None))).all():
            bind.execute(subs.update().where(subs.c.id == sid).values(token=secrets.token_urlsafe(24)))
        op.create_index("ix_subscribers_token", "subscribers", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_subscribers_token", "subscribers")
    with op.batch_alter_table("subscribers") as b:
        b.drop_column("token")
        b.drop_column("confirmed")
    with op.batch_alter_table("issues") as b:
        b.drop_column("notified_at")
    with op.batch_alter_table("users") as b:
        b.drop_column("pending")
    op.drop_table("email_outbox")
