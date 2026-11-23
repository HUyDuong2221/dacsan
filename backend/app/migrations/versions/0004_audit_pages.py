"""Nhật ký hoạt động (audit_logs) và trang nội dung tĩnh (pages).

Chỉ tạo bảng mới. Bảng pages mới tạo được thêm sẵn 3 trang khung (Giới thiệu, Ban biên tập, Hỏi đáp)
để ban biên tập điền nội dung; không ghi đè nếu bảng đã có.

Revision ID: 0004_audit_pages
Revises: 0003_submission_toc_entry
Create Date: 2026-11-23
"""
import sqlalchemy as sa
from alembic import op

revision = "0004_audit_pages"
down_revision = "0003_submission_toc_entry"
branch_labels = None
depends_on = None

_TODO = "<p><em>Nội dung đang được cập nhật.</em></p>"
DEFAULT_PAGES = [
    ("gioi-thieu", "Giới thiệu", _TODO, 1),
    ("ban-bien-tap", "Ban biên tập", _TODO, 2),
    ("hoi-dap", "Hỏi đáp", (
        "<h2>Gửi bài cho Đặc san như thế nào?</h2>"
        "<p>Vào trang <a href=\"/gui-bai\">Gửi bài</a>, điền thông tin, tải bản thảo (Word .doc/.docx, PDF hoặc .odt, "
        "tối đa 20MB) và xác nhận cam kết bản quyền. Sau khi gửi, bạn nhận được một mã tra cứu.</p>"
        "<h2>Theo dõi tình trạng bài đã gửi ở đâu?</h2>"
        "<p>Vào trang <a href=\"/gui-bai/theo-doi\">Tra cứu bài gửi</a>, nhập email đã dùng khi gửi bài và mã tra cứu.</p>"
        "<h2>Làm sao nhận thông báo khi có số mới?</h2>"
        "<p>Nhập email vào ô đăng ký nhận tin ở trang chủ.</p>"
    ), 3),
]


def upgrade() -> None:
    have = set(sa.inspect(op.get_bind()).get_table_names())
    if "audit_logs" not in have:
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("user_email", sa.String(255), nullable=False, server_default=""),
            sa.Column("action", sa.String(40), nullable=False),
            sa.Column("entity", sa.String(60), nullable=False, server_default=""),
            sa.Column("entity_id", sa.String(40), nullable=True),
            sa.Column("summary", sa.String(500), nullable=False, server_default=""),
            sa.Column("method", sa.String(10), nullable=False, server_default=""),
            sa.Column("path", sa.String(300), nullable=False, server_default=""),
            sa.Column("status_code", sa.Integer, nullable=False, server_default="0"),
            sa.Column("ip", sa.String(64), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        for col in ("user_id", "action", "entity", "created_at"):
            op.create_index(f"ix_audit_logs_{col}", "audit_logs", [col])
    if "pages" not in have:
        pages = op.create_table(
            "pages",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("slug", sa.String(120), nullable=False),
            sa.Column("title", sa.String(300), nullable=False),
            sa.Column("content", sa.Text, nullable=True),
            sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
            sa.Column("published", sa.Boolean, nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_pages_slug", "pages", ["slug"], unique=True)
        op.bulk_insert(pages, [
            {"slug": s, "title": t, "content": c, "sort_order": o, "published": True} for s, t, c, o in DEFAULT_PAGES
        ])


def downgrade() -> None:
    op.drop_table("pages")
    op.drop_table("audit_logs")
