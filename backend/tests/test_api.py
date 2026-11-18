"""Test chạy trên SQLite (đăng ký hàm unaccent giả) để không cần Postgres."""
import os
import tempfile
import unicodedata

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["MEDIA_DIR"] = f"{_tmp}/media"
os.environ["ADMIN_EMAIL"] = "admin@test.vn"
os.environ["ADMIN_PASSWORD"] = "secret-pass"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import event, select  # noqa: E402

from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base, User  # noqa: E402
from app.security import hash_password, reset_fails  # noqa: E402
from app.seed import seed  # noqa: E402


def _unaccent(s):
    if s is None:
        return None
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


@event.listens_for(engine, "connect")
def _reg(conn, _):
    conn.create_function("unaccent", 1, _unaccent)
    conn.execute("PRAGMA foreign_keys=ON")


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add(User(email="admin@test.vn", password_hash=hash_password("secret-pass")))
        db.commit()
        seed(db)
    return TestClient(app)


@pytest.fixture(scope="module")
def auth(client):
    reset_fails()
    r = client.post("/api/v1/admin/auth/login", json={"email": "admin@test.vn", "password": "secret-pass"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


P = "/api/v1/public"
A = "/api/v1/admin"


def test_home(client):
    d = client.get(f"{P}/home").json()
    assert d["latest_issue"]["number"] == 17
    assert len(d["hero"]) == 6
    assert len(d["articles"]) == 25
    assert len(d["issues"]) == 8 and d["issues"][0]["number"] == 16  # không gồm số mới nhất
    assert d["hero"][0]["href"] == "/issues/so-17-6-2026" and d["hero"][0]["excerpt"]
    assert d["hero"][1]["kicker"] == "Phạm Ngọc Linh · tr. 13"
    assert d["stats"] == {"issue_count": 13, "year_from": 2024, "year_to": 2026}


def test_issue_detail_groups(client):
    d = client.get(f"{P}/issues/so-17-6-2026").json()
    assert d["total"] == 25 and len(d["front"]) == 2
    assert [g["field"] for g in d["groups"]][0].startswith("Đại hội")


def test_article_fulltext_and_nav(client):
    slug = client.get(f"{P}/issues/so-17-6-2026").json()["groups"][0]["items"][0]["slug"]
    d = client.get(f"{P}/articles/{slug}").json()
    assert d["has_fulltext"] is True
    assert d["toc"][0] == "Lời dẫn" and "Kỳ vọng nhiệm kỳ mới" in d["toc"]
    assert d["citation"].startswith("Phạm Ngọc Linh (2026)")
    assert d["prev"]["slug"] and d["next"]["slug"]


def test_search_without_accents(client):
    r = client.get(f"{P}/search", params={"q": "tri thuc moi cua xu quang"}).json()
    assert r["count"] >= 1
    assert client.get(f"{P}/search", params={"q": "x"}).status_code == 422


def test_subscribe_validation(client):
    assert client.post(f"{P}/subscribe", json={"email": "bad"}).status_code == 422
    assert client.post(f"{P}/subscribe", json={"email": "a@b.vn"}).status_code == 200
    assert client.post(f"{P}/subscribe", json={"email": "A@b.vn"}).status_code == 200  # không trùng


def test_chat(client):
    assert client.post(f"{P}/chat", json={"question": "Thể lệ gửi bài?"}).json()["link"] == "/docs"
    assert client.post(f"{P}/chat", json={"question": "Phạm Ngọc Linh"}).json()["articles"]


def test_admin_requires_auth(client):
    assert client.get(f"{A}/toc-entries").status_code == 401
    assert client.post(f"{A}/auth/login", json={"email": "x@y.z", "password": "no"}).status_code == 401


def test_admin_toc_entry_crud_visibility_follows_issue(client, auth):
    issue_id = client.get(f"{A}/issues", headers=auth).json()[0]["id"]  # số 17 đang công bố
    r = client.post(f"{A}/toc-entries", headers=auth, json={"issue_id": issue_id, "title": "Mục lục thử nghiệm", "page_label": "tr. 140"})
    assert r.status_code == 201, r.text
    e = r.json()
    assert e["slug"] == "muc-luc-thu-nghiem" and "status" not in e
    # là dòng mục lục: hiện ngay khi số đã công bố, chưa có toàn văn
    assert client.get(f"{P}/articles/{e['slug']}").json()["has_fulltext"] is False
    r = client.put(f"{A}/toc-entries/{e['id']}", headers=auth, json={"body": "## Mục\n\nNội dung"})
    assert r.status_code == 200
    assert client.get(f"{P}/articles/{e['slug']}").json()["has_fulltext"] is True
    assert client.delete(f"{A}/toc-entries/{e['id']}", headers=auth).status_code == 204


def test_unpublished_issue_hides_its_toc(client, auth):
    i = client.post(f"{A}/issues", headers=auth, json={"number": 88, "published_at": "2026-01-01", "theme": "ẩn"}).json()
    e = client.post(f"{A}/toc-entries", headers=auth, json={"issue_id": i["id"], "title": "Dòng ẩn"}).json()
    assert client.get(f"{P}/articles/{e['slug']}").status_code == 404
    assert client.get(f"{P}/issues/{i['slug']}").status_code == 404
    client.put(f"{A}/issues/{i['id']}", headers=auth, json={"published": True})
    assert client.get(f"{P}/issues/{i['slug']}").json()["total"] == 1
    client.delete(f"{A}/issues/{i['id']}", headers=auth)


def test_admin_validation(client, auth):
    assert client.post(f"{A}/toc-entries", headers=auth, json={"title": "thiếu issue"}).status_code == 422
    assert client.post(f"{A}/issues", headers=auth, json={"number": "abc", "label": "x", "theme": "y"}).status_code == 422
    assert client.post(f"{A}/activities", headers=auth, json={"title": "t", "event_date": "not-a-date"}).status_code == 422


def test_upload_rules(client, auth):
    bad = client.post(f"{A}/upload", headers=auth, files={"file": ("x.exe", b"MZ")})
    assert bad.status_code == 415
    ok = client.post(f"{A}/upload", headers=auth, files={"file": ("a.pdf", b"%PDF-1.4")})
    assert ok.status_code == 200
    assert client.get(ok.json()["url"]).status_code == 200


def test_delete_issue_cascades(client, auth):
    n = client.post(f"{A}/issues", headers=auth, json={"number": 99, "label": "Số 99", "theme": "t"}).json()
    client.post(f"{A}/toc-entries", headers=auth, json={"issue_id": n["id"], "title": "con"})
    assert client.delete(f"{A}/issues/{n['id']}", headers=auth).status_code == 204
    assert client.get(f"{A}/toc-entries", headers=auth, params={"issue_id": n["id"]}).json() == []


def test_issue_label_derived_from_number_and_date(client, auth):
    r = client.post(f"{A}/issues", headers=auth, json={"number": 18, "published_at": "2026-08-15", "theme": "Chủ đề thử"})
    assert r.status_code == 201, r.text
    i = r.json()
    assert i["label"] == "Số 18 (8-2026)" and i["year"] == 2026 and i["slug"] == "so-18-8-2026"
    # đổi ngày đăng -> nhãn tự cập nhật; sửa trường khác không đụng tới nhãn
    assert client.put(f"{A}/issues/{i['id']}", headers=auth, json={"published_at": "2026-09-02"}).json()["label"] == "Số 18 (9-2026)"
    assert client.put(f"{A}/issues/{i['id']}", headers=auth, json={"published": True}).json()["label"] == "Số 18 (9-2026)"
    assert client.get(f"{P}/issues").json()["issues"][0]["published_at"] == "2026-09-02"
    assert client.post(f"{A}/issues", headers=auth, json={"theme": "thiếu số"}).status_code == 422
    client.delete(f"{A}/issues/{i['id']}", headers=auth)


# ---------- mục lục từ PDF ----------
def _make_pdf(path, outline=False):
    import fitz

    doc = fitz.open()
    doc.new_page()  # bìa
    pg = doc.new_page()
    pg.insert_text((50, 60), "MUC LUC", fontsize=16)
    y = 100
    rows = [("NHAN VAT", None), ("NGUYEN VAN A - Mot nguoi di truoc", 7), ("TRAN THI B - Bai viet co tieu de rat dai can phai", None),
            ("xuong dong de kiem tra", 12), ("CAU CHUYEN VAN HOA", None), ("LE C - Hon bien", 15), ("P.V - Thong tin khoa hoc", 18),
            ("Loi thua khong tac gia", 20)]
    for text, num in rows:
        pg.insert_text((50, y), text, fontsize=11)
        if num:
            pg.insert_text((520, y), str(num), fontsize=11)
        y += 22
    for _ in range(22):
        doc.new_page()
    if outline:
        doc.set_toc([[1, "NHAN VAT", 7], [2, "NGUYEN VAN A - Mot nguoi", 7], [2, "Bai hai", 9], [2, "Bai ba", 10],
                     [1, "VAN HOA", 12], [2, "Bai bon", 12], [2, "Bai nam", 14]])
    doc.save(path)
    doc.close()


def test_toc_text_parse():
    from app.toc import extract_toc

    p = f"{_tmp}/toc_text.pdf"
    _make_pdf(p)
    r = extract_toc(p)
    assert r["source"] == "text"
    it = r["items"]
    assert [i["page"] for i in it] == [7, 12, 15, 18, 20]
    assert it[0] == {"field": "Nhan vat", "author": "Nguyen Van A", "title": "Mot nguoi di truoc", "page": 7}
    assert it[1]["title"].endswith("xuong dong de kiem tra")  # tiêu đề xuống dòng được nối lại
    assert it[2]["field"] == "Cau chuyen van hoa" and it[3]["author"] == "P.V"
    assert it[4]["author"] == "" and it[4]["title"] == "Loi thua khong tac gia"


def test_toc_outline_parse():
    from app.toc import extract_toc

    p = f"{_tmp}/toc_outline.pdf"
    _make_pdf(p, outline=True)
    r = extract_toc(p)
    assert r["source"] == "outline" and len(r["items"]) == 5
    assert r["items"][0]["field"] == "Nhan vat" and r["items"][3]["field"] == "Van hoa"


def test_toc_rejects_pdf_without_toc():
    import fitz
    from app.toc import extract_toc

    p = f"{_tmp}/blank.pdf"
    d = fitz.open(); d.new_page(); d.save(p); d.close()
    with pytest.raises(ValueError):
        extract_toc(p)


def test_toc_endpoints_preview_and_idempotent_import(client, auth):
    import shutil

    os.makedirs(os.environ["MEDIA_DIR"], exist_ok=True)
    _make_pdf(f"{os.environ['MEDIA_DIR']}/so55.pdf")
    i = client.post(f"{A}/issues", headers=auth, json={"number": 55, "published_at": "2026-05-01", "theme": "t", "pdf_url": "/media/so55.pdf"}).json()
    nopdf = client.post(f"{A}/issues", headers=auth, json={"number": 56, "published_at": "2026-05-01", "theme": "t"}).json()
    assert client.post(f"{A}/issues/{nopdf['id']}/toc/preview", headers=auth).status_code == 422
    assert client.post(f"{A}/issues/{i['id']}/toc/preview").status_code == 401
    pre = client.post(f"{A}/issues/{i['id']}/toc/preview", headers=auth)
    assert pre.status_code == 200 and len(pre.json()["items"]) == 5
    items = pre.json()["items"]
    r = client.post(f"{A}/issues/{i['id']}/toc/import", headers=auth, json={"items": items}).json()
    assert r == {"created": 5, "skipped": 0}
    assert client.post(f"{A}/issues/{i['id']}/toc/import", headers=auth, json={"items": items}).json() == {"created": 0, "skipped": 5}
    arts = client.get(f"{A}/toc-entries", headers=auth, params={"issue_id": i["id"]}).json()
    assert len(arts) == 5
    assert [a["sort_order"] for a in arts] == [0, 1, 2, 3, 4]
    assert client.get(f"{P}/issues/{i['slug']}").status_code == 404 or client.get(f"{P}/issues/{i['slug']}").json()["total"] == 0  # số chưa công bố thì mục lục không lộ
    fields = {f["name"]: f["id"] for f in client.get(f"{A}/fields", headers=auth).json()}
    assert "Nhan vat" not in fields  # khớp chuyên mục có sẵn "Nhân vật" (không phân biệt dấu), không tạo trùng
    assert arts[0]["field_id"] == fields["Nhân vật"]
    client.delete(f"{A}/issues/{i['id']}", headers=auth)
    client.delete(f"{A}/issues/{nopdf['id']}", headers=auth)
