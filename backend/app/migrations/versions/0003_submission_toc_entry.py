"""Liên kết bài gửi với dòng mục lục tạo từ nó (submissions.toc_entry_id).

Chỉ thêm một cột nullable, dữ liệu cũ giữ nguyên (NULL). Bỏ qua nếu cột đã có
(DB mới: create_all trong init_db() đã tạo bảng submissions theo model hiện tại).

Revision ID: 0003_submission_toc_entry
Revises: 0002_reviews_history
Create Date: 2026-11-23
"""
import sqlalchemy as sa
from alembic import op

revision = "0003_submission_toc_entry"
down_revision = "0002_reviews_history"
branch_labels = None
depends_on = None

FK = "fk_submissions_toc_entry_id"


def upgrade() -> None:
    cols = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("submissions")}
    if "toc_entry_id" in cols:
        return
    # batch: Postgres chạy ALTER TABLE trực tiếp; SQLite (test) tự dựng lại bảng
    with op.batch_alter_table("submissions") as b:
        b.add_column(sa.Column("toc_entry_id", sa.Integer, nullable=True))
        b.create_foreign_key(FK, "toc_entries", ["toc_entry_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    with op.batch_alter_table("submissions") as b:
        b.drop_constraint(FK, type_="foreignkey")
        b.drop_column("toc_entry_id")
