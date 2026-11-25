"""Migration Alembic trên DB kiểu cũ."""
import os

from app.models import Base


def test_alembic_migrations_on_existing_db(tmp_path):
    """DB cũ (chỉ có các bảng tạo bằng create_all) nâng cấp lên head được, chạy lại không lỗi, dữ liệu cũ giữ nguyên."""
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, inspect, text

    eng = create_engine(f"sqlite:///{tmp_path}/old.db")
    legacy = [t for t in Base.metadata.sorted_tables if not t.info.get("alembic") and t.name != "submissions"]
    Base.metadata.create_all(eng, tables=legacy)
    with eng.begin() as c:
        # bảng submissions đúng hình dạng trước Alembic (chưa có toc_entry_id)
        c.execute(text(
            "CREATE TABLE submissions (id INTEGER PRIMARY KEY, code VARCHAR(16) UNIQUE, name VARCHAR(200), email VARCHAR(255), "
            "organization VARCHAR(300), phone VARCHAR(40), field_name VARCHAR(200), title VARCHAR(600), abstract TEXT, "
            "file_path VARCHAR(100), file_name VARCHAR(300), status VARCHAR(20), note_public TEXT, note_internal TEXT, "
            "created_at DATETIME, updated_at DATETIME)"))
        c.execute(text(
            "INSERT INTO submissions (code, name, email, organization, phone, field_name, title, abstract, file_path, "
            "file_name, status, created_at, updated_at) "
            "VALUES ('OLD1', 'A', 'a@x.vn', '', '', '', 'Bài cũ', 'tt', 'f', 'f', 'accepted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"))
        # banner đơn kiểu cũ trong cấu hình: phải được chuyển sang bảng banners
        # số đã công bố từ trước: phải được đánh dấu "đã báo" để không bị gửi thư "số mới" khi sửa
        c.execute(text("INSERT INTO issues (slug, number, label, year, theme, published, featured, created_at, updated_at) "
                       "VALUES ('so-cu', 1, 'Số 01', 2024, 'Cũ', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), "
                       "('so-nhap', 2, 'Số 02', 2024, 'Nháp', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"))
        c.execute(text("INSERT INTO settings (key, value) VALUES ('banner_url', '/media/banner/cu.jpg'), "
                       "('banner_link', '/issues'), ('banner_alt', 'Banner cũ'), ('issn', '2734-9098')"))
    cfg = Config()
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "app", "migrations"))
    for _ in range(2):
        with eng.begin() as c:
            cfg.attributes["connection"] = c
            command.upgrade(cfg, "head")
    tables = set(inspect(eng).get_table_names())
    assert {"reviews", "submission_history", "alembic_version"} <= tables
    insp = inspect(eng)
    assert "toc_entry_id" in {col["name"] for col in insp.get_columns("submissions")}
    assert any(fk["referred_table"] == "toc_entries" for fk in insp.get_foreign_keys("submissions"))
    with eng.connect() as c:
        assert c.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0012_spotlights"
        assert c.execute(text("SELECT count(*) FROM pages")).scalar() == 3  # 3 trang khung
        assert [tuple(r) for r in c.execute(text("SELECT image_url, link, alt, position FROM banners"))] == [
            ("/media/banner/cu.jpg", "/issues", "Banner cũ", "top")]
        assert {r[0] for r in c.execute(text("SELECT key FROM settings"))} == {"issn"}  # khóa banner cũ đã gỡ
        notified = dict(c.execute(text("SELECT slug, notified_at IS NOT NULL FROM issues")).all())
        assert notified == {"so-cu": 1, "so-nhap": 0}
        row = c.execute(text("SELECT status, toc_entry_id FROM submissions WHERE code='OLD1'")).one()
        assert tuple(row) == ("accepted", None)
    eng.dispose()
