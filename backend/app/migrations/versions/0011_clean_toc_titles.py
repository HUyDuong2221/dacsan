"""Dọn ký tự rác (ô vuông □, ký tự vùng riêng của font) trong tiêu đề/tác giả mục lục đã nhập từ PDF.

Revision ID: 0011_clean_toc_titles
Revises: 0010_user_profile
Create Date: 2026-11-25
"""
import sqlalchemy as sa
from alembic import op

from app.services.util import clean_text

revision = "0011_clean_toc_titles"
down_revision = "0010_user_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "toc_entries" not in set(sa.inspect(bind).get_table_names()):
        return
    rows = bind.execute(sa.text("SELECT id, title, author FROM toc_entries")).all()
    for id_, title, author in rows:
        t, a = clean_text(title or ""), clean_text(author or "")
        if t and (t != title or a != (author or "")):
            bind.execute(sa.text("UPDATE toc_entries SET title=:t, author=:a WHERE id=:i"), {"t": t, "a": a, "i": id_})


def downgrade() -> None:
    pass
