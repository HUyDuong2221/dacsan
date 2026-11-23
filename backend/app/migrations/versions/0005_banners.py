"""Banner trang chủ dạng danh sách (nhiều banner, mỗi banner một vị trí; cùng vị trí thành slider).

Chuyển banner đơn đang có ở cấu hình (banner_url, banner_link, banner_alt) thành banner đầu tiên ở vị trí "top"
rồi xóa ba khóa cấu hình đó, để chỉ còn một nguồn dữ liệu.

Revision ID: 0005_banners
Revises: 0004_audit_pages
Create Date: 2026-11-23
"""
import sqlalchemy as sa
from alembic import op

revision = "0005_banners"
down_revision = "0004_audit_pages"
branch_labels = None
depends_on = None

OLD_KEYS = ("banner_url", "banner_link", "banner_alt")


def upgrade() -> None:
    bind = op.get_bind()
    if "banners" in set(sa.inspect(bind).get_table_names()):
        return
    banners = op.create_table(
        "banners",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("image_url", sa.String(500), nullable=False),
        sa.Column("link", sa.String(500), nullable=True),
        sa.Column("alt", sa.String(300), nullable=False, server_default=""),
        sa.Column("position", sa.String(30), nullable=False, server_default="top"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("published", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    settings = sa.table("settings", sa.column("key", sa.String), sa.column("value", sa.Text))
    old = {k: (v or "").strip() for k, v in bind.execute(sa.select(settings.c.key, settings.c.value)
                                                        .where(settings.c.key.in_(OLD_KEYS))).all()}
    if old.get("banner_url"):
        op.bulk_insert(banners, [{
            "image_url": old["banner_url"][:500], "link": old.get("banner_link")[:500] if old.get("banner_link") else None,
            "alt": (old.get("banner_alt") or "")[:300], "position": "top", "sort_order": 0, "published": True,
        }])
    bind.execute(settings.delete().where(settings.c.key.in_(OLD_KEYS)))


def downgrade() -> None:
    op.drop_table("banners")
