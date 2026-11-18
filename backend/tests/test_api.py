"""Test chạy trên SQLite (đăng ký hàm unaccent giả) để không cần Postgres."""
import os
import tempfile
import unicodedata

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["MEDIA_DIR"] = f"{_tmp}/media"
os.environ["PRIVATE_DIR"] = f"{_tmp}/private"
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
    assert client.post(f"{P}/chat", json={"question": "Thể lệ gửi bài?"}).json()["link"] == "/gui-bai"
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
    rows = [("Loi thua", None), ("NHAN VAT", None), ("NGUYEN VAN A - Mot nguoi di truoc", 7), ("TRAN THI B - Bai viet co tieu de rat dai can phai", None),
            ("xuong dong de kiem tra", 12), ("CAU CHUYEN VAN HOA", None), ("LE C - Hon bien", 15), ("P.V - Thong tin khoa hoc", 18),
            ("Loi thua khong tac gia", 20)]
    for text, num in rows:
        pg.insert_text((50, y), text, fontsize=11)
        if num:
            pg.insert_text((520, y), str(num), fontsize=11)
        y += 22
    for _ in range(22):
        doc.new_page()
    for k in range(1, 5):  # tiêu đề chạy đầu trang: "4 DAC SAN KHOA HOC…" lặp ở nhiều trang
        doc[k].insert_text((50, 30), f"{k + 3} DAC SAN KHOA HOC & PHAT TRIEN THANH PHO DA NANG", fontsize=9)
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
    assert [i["page"] for i in it] == [0, 7, 12, 15, 18, 20]
    # dòng không có số trang đứng trước tên phần ("Lời thưa") là một mục riêng, không bị dính vào tên phần/tác giả
    assert it[0] == {"field": "", "author": "", "title": "Loi thua", "page": 0}
    assert it[1] == {"field": "NHAN VAT", "author": "Nguyen Van A", "title": "Mot nguoi di truoc", "page": 7}
    assert it[2]["title"].endswith("xuong dong de kiem tra")  # tiêu đề xuống dòng được nối lại
    assert it[3]["field"] == "CAU CHUYEN VAN HOA" and it[4]["author"] == "P.V"
    assert it[5]["author"] == "" and it[5]["title"] == "Loi thua khong tac gia"


def test_toc_outline_parse():
    from app.toc import extract_toc

    p = f"{_tmp}/toc_outline.pdf"
    _make_pdf(p, outline=True)
    r = extract_toc(p)
    assert r["source"] == "outline" and len(r["items"]) == 5
    assert r["items"][0]["field"] == "NHAN VAT" and r["items"][3]["field"] == "VAN HOA"


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
    assert pre.status_code == 200 and len(pre.json()["items"]) == 6
    items = pre.json()["items"]
    r = client.post(f"{A}/issues/{i['id']}/toc/import", headers=auth, json={"items": items}).json()
    assert r == {"created": 6, "skipped": 0}
    assert client.post(f"{A}/issues/{i['id']}/toc/import", headers=auth, json={"items": items}).json() == {"created": 0, "skipped": 6}
    arts = client.get(f"{A}/toc-entries", headers=auth, params={"issue_id": i["id"]}).json()
    assert len(arts) == 6
    assert [a["sort_order"] for a in arts] == [0, 1, 2, 3, 4, 5]
    assert arts[0]["page_label"] == ""
    assert client.get(f"{P}/issues/{i['slug']}").status_code == 404 or client.get(f"{P}/issues/{i['slug']}").json()["total"] == 0  # số chưa công bố thì mục lục không lộ
    fields = {f["name"]: f["id"] for f in client.get(f"{A}/fields", headers=auth).json()}
    assert "NHAN VAT" not in fields  # khớp chuyên mục có sẵn "Nhân vật" (không phân biệt dấu), không tạo trùng
    assert arts[1]["field_id"] == fields["Nhân vật"]
    client.delete(f"{A}/issues/{i['id']}", headers=auth)
    client.delete(f"{A}/issues/{nopdf['id']}", headers=auth)


def test_toc_text_ignores_running_page_header():
    from app.toc import extract_toc

    p = f"{_tmp}/toc_header.pdf"
    _make_pdf(p)
    r = extract_toc(p)
    assert all("DAC SAN" not in (i["field"] + i["title"]) for i in r["items"])


def test_sections_are_per_issue_and_replace_import(client, auth):
    # tab chuyên mục ở trang chủ chỉ gồm các phần của số mới nhất, không lẫn chuyên mục của số khác
    iss = client.post(f"{A}/issues", headers=auth, json={"number": 200, "published_at": "2027-01-01", "theme": "t", "published": True}).json()
    for n, (fld, title) in enumerate([("PHAN MOT", "a"), ("PHAN HAI", "b"), ("PHAN MOT", "c")]):
        fid = client.post(f"{A}/fields", headers=auth, json={"name": fld}).json().get("id") if n < 2 else None
        if fid is None:
            fid = next(f["id"] for f in client.get(f"{A}/fields", headers=auth).json() if f["name"] == fld)
        client.post(f"{A}/toc-entries", headers=auth, json={"issue_id": iss["id"], "title": title, "field_id": fid, "sort_order": n})
    assert client.get(f"{P}/home").json()["fields"] == ["PHAN MOT", "PHAN HAI"]
    assert client.get(f"{P}/issues").json()["fields"] == ["PHAN MOT", "PHAN HAI"]
    # nhập lại ở chế độ thay thế: xóa mục lục cũ của số rồi tạo lại
    items = [{"field": "MOI", "author": "", "title": f"dong {k}", "page": k + 1} for k in range(3)]
    assert client.post(f"{A}/issues/{iss['id']}/toc/import", headers=auth, json={"items": items, "replace": True}).json() == {"created": 3, "skipped": 0}
    assert len(client.get(f"{A}/toc-entries", headers=auth, params={"issue_id": iss["id"]}).json()) == 3
    assert client.get(f"{P}/home").json()["fields"] == ["MOI"]
    client.delete(f"{A}/issues/{iss['id']}", headers=auth)


def test_merge_field(client, auth):
    a = client.post(f"{A}/fields", headers=auth, json={"name": "GOP A"}).json()
    b = client.post(f"{A}/fields", headers=auth, json={"name": "GOP B"}).json()
    iss = client.post(f"{A}/issues", headers=auth, json={"number": 300, "published_at": "2027-02-01", "theme": "t"}).json()
    e = client.post(f"{A}/toc-entries", headers=auth, json={"issue_id": iss["id"], "title": "dong gop", "field_id": a["id"]}).json()
    assert client.post(f"{A}/fields/{a['id']}/merge", headers=auth, json={"target_id": a["id"]}).status_code == 422
    assert client.post(f"{A}/fields/{a['id']}/merge", headers=auth, json={"target_id": b["id"]}).json() == {"moved": 1}
    assert client.get(f"{A}/toc-entries", headers=auth, params={"issue_id": iss["id"]}).json()[0]["field_id"] == b["id"]
    assert a["id"] not in [f["id"] for f in client.get(f"{A}/fields", headers=auth).json()]
    client.put(f"{A}/fields/{b['id']}", headers=auth, json={"name": "GOP B da doi ten"})  # đổi tên chuyên mục
    assert any(f["name"] == "GOP B da doi ten" for f in client.get(f"{A}/fields", headers=auth).json())
    client.delete(f"{A}/issues/{iss['id']}", headers=auth)


# ---------- người dùng & phân quyền ----------
def _login(client, email, pw):
    reset_fails()
    r = client.post(f"{A}/auth/login", json={"email": email, "password": pw})
    return r, ({"Authorization": f"Bearer {r.json()['token']}"} if r.status_code == 200 else None)


def test_user_management_and_role_matrix(client, auth):
    # chỉ admin quản lý user; validate đầu vào
    assert client.post(f"{A}/users", headers=auth, json={"email": "bad", "password": "12345678"}).status_code == 422
    assert client.post(f"{A}/users", headers=auth, json={"email": "x@y.vn", "password": "short"}).status_code == 422
    assert client.post(f"{A}/users", headers=auth, json={"email": "x@y.vn", "password": "12345678", "role": "root"}).status_code == 422
    ed = client.post(f"{A}/users", headers=auth, json={"email": "Editor@T.vn", "full_name": "BTV", "role": "editor", "password": "editor-pass-1"})
    co = client.post(f"{A}/users", headers=auth, json={"email": "ctv@t.vn", "role": "contributor", "password": "contrib-pass-1"})
    assert ed.status_code == 201 and co.status_code == 201 and ed.json()["email"] == "editor@t.vn"
    assert "password" not in ed.json() and "password_hash" not in ed.json()
    assert client.post(f"{A}/users", headers=auth, json={"email": "editor@t.vn", "password": "12345678"}).status_code == 409

    _, h_ed = _login(client, "editor@t.vn", "editor-pass-1")
    _, h_co = _login(client, "ctv@t.vn", "contrib-pass-1")
    assert client.get(f"{A}/auth/me", headers=h_co).json()["role"] == "contributor"

    # chỉ admin
    for h in (h_ed, h_co):
        assert client.get(f"{A}/users", headers=h).status_code == 403
        assert client.get(f"{A}/settings", headers=h).status_code == 403
        assert client.get(f"{A}/subscribers", headers=h).status_code == 403
    # biên tập viên: làm được nội dung
    assert client.get(f"{A}/activities", headers=h_ed).status_code == 200
    n = client.post(f"{A}/issues", headers=h_ed, json={"number": 400, "published_at": "2027-03-01", "theme": "BTV tạo"}).json()
    assert client.put(f"{A}/issues/{n['id']}", headers=h_ed, json={"published": True}).status_code == 200
    # cộng tác viên: đọc được số, không tạo/sửa số, không đụng hoạt động/chuyên mục/nhập PDF
    assert client.get(f"{A}/issues", headers=h_co).status_code == 200
    assert client.post(f"{A}/issues", headers=h_co, json={"number": 401, "published_at": "2027-03-01", "theme": "x"}).status_code == 403
    assert client.put(f"{A}/issues/{n['id']}", headers=h_co, json={"published": False}).status_code == 403
    assert client.get(f"{A}/activities", headers=h_co).status_code == 403
    assert client.post(f"{A}/fields", headers=h_co, json={"name": "CTV tạo"}).status_code == 403
    assert client.post(f"{A}/issues/{n['id']}/toc/preview", headers=h_co).status_code == 403
    # cộng tác viên nhập mục lục: CHỈ ở số chưa công bố, và không được xóa
    r = client.post(f"{A}/toc-entries", headers=h_co, json={"issue_id": n["id"], "title": "CTV thêm vào số đã công bố"})
    assert r.status_code == 403
    client.put(f"{A}/issues/{n['id']}", headers=h_ed, json={"published": False})
    r = client.post(f"{A}/toc-entries", headers=h_co, json={"issue_id": n["id"], "title": "CTV thêm dòng"})
    assert r.status_code == 201, r.text
    eid = r.json()["id"]
    assert client.put(f"{A}/toc-entries/{eid}", headers=h_co, json={"body": "nội dung"}).status_code == 200
    assert client.delete(f"{A}/toc-entries/{eid}", headers=h_co).status_code == 403
    client.put(f"{A}/issues/{n['id']}", headers=h_ed, json={"published": True})
    assert client.put(f"{A}/toc-entries/{eid}", headers=h_co, json={"body": "sửa sau khi công bố"}).status_code == 403
    assert client.post(f"{A}/upload", headers=h_co, files={"file": ("a.pdf", b"%PDF")}).status_code == 200
    assert client.delete(f"{A}/toc-entries/{eid}", headers=h_ed).status_code == 204
    client.delete(f"{A}/issues/{n['id']}", headers=h_ed)

    # đổi vai trò có hiệu lực ngay (token cũ); khóa tài khoản chặn cả token cũ lẫn đăng nhập mới
    uid = co.json()["id"]
    assert client.put(f"{A}/users/{uid}", headers=auth, json={"role": "editor"}).status_code == 200
    assert client.get(f"{A}/activities", headers=h_co).status_code == 200
    assert client.put(f"{A}/users/{uid}", headers=auth, json={"is_active": False}).status_code == 200
    assert client.get(f"{A}/auth/me", headers=h_co).status_code == 401
    assert _login(client, "ctv@t.vn", "contrib-pass-1")[0].status_code == 401
    # để trống mật khẩu khi sửa = giữ nguyên; có mật khẩu mới = đổi
    client.put(f"{A}/users/{uid}", headers=auth, json={"is_active": True, "password": ""})
    assert _login(client, "ctv@t.vn", "contrib-pass-1")[0].status_code == 200
    client.put(f"{A}/users/{uid}", headers=auth, json={"password": "mat-khau-moi-9"})
    assert _login(client, "ctv@t.vn", "contrib-pass-1")[0].status_code == 401
    assert _login(client, "ctv@t.vn", "mat-khau-moi-9")[0].status_code == 200
    for u in (ed.json()["id"], uid):
        assert client.delete(f"{A}/users/{u}", headers=auth).status_code == 204


def test_user_safeguards_and_change_password(client, auth):
    me = client.get(f"{A}/auth/me", headers=auth).json()
    mine = next(u for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == me["email"])
    assert client.delete(f"{A}/users/{mine['id']}", headers=auth).status_code == 422
    assert client.put(f"{A}/users/{mine['id']}", headers=auth, json={"role": "editor"}).status_code == 422
    assert client.put(f"{A}/users/{mine['id']}", headers=auth, json={"is_active": False}).status_code == 422
    # đổi mật khẩu của chính mình
    u = client.post(f"{A}/users", headers=auth, json={"email": "pw@t.vn", "password": "old-password-1", "role": "editor"}).json()
    _, h = _login(client, "pw@t.vn", "old-password-1")
    assert client.post(f"{A}/auth/change-password", headers=h, json={"old_password": "sai", "new_password": "new-password-1"}).status_code == 422
    assert client.post(f"{A}/auth/change-password", headers=h, json={"old_password": "old-password-1", "new_password": "short"}).status_code == 422
    assert client.post(f"{A}/auth/change-password", headers=h, json={"old_password": "old-password-1", "new_password": "new-password-1"}).status_code == 200
    assert _login(client, "pw@t.vn", "new-password-1")[0].status_code == 200
    client.delete(f"{A}/users/{u['id']}", headers=auth)


# ---------- gửi bài ----------
def _form(**kw):
    d = {"name": "Nguyễn Văn A", "email": "Tacgia@Mail.vn", "title": "Bài nghiên cứu thử nghiệm",
         "abstract": "Đây là phần tóm tắt dài hơn ba mươi ký tự để qua kiểm tra.", "consent": "true",
         "organization": "ĐH X", "field_name": "Thông tin"}
    d.update(kw)
    return d


DOCX = ("ban-thao.docx", b"PK\x03\x04 noi dung ban thao", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")


def test_submission_flow(client, auth):
    reset_fails()
    ok = client.post(f"{P}/submissions", data=_form(), files={"file": DOCX})
    assert ok.status_code == 201, ok.text
    code = ok.json()["code"]
    assert len(code) == 8

    # kiểm tra đầu vào
    bad = [
        (_form(consent=""), {"file": DOCX}, 422),
        (_form(email="khong-hop-le"), {"file": DOCX}, 422),
        (_form(abstract="quá ngắn"), {"file": DOCX}, 422),
        (_form(), {"file": ("virus.exe", b"MZ", "application/octet-stream")}, 415),
        (_form(), {"file": ("rong.docx", b"", "application/octet-stream")}, 422),
    ]
    for data, files, status in bad:
        assert client.post(f"{P}/submissions", data=data, files=files).status_code == status
    # ô bẫy bot: trả giả thành công nhưng không lưu
    n_before = len(client.get(f"{A}/submissions", headers=auth).json())
    assert client.post(f"{P}/submissions", data=_form(website="http://spam"), files={"file": DOCX}).status_code == 201
    assert len(client.get(f"{A}/submissions", headers=auth).json()) == n_before

    # ban biên tập
    assert client.get(f"{A}/submissions").status_code == 401
    lst = client.get(f"{A}/submissions", headers=auth).json()
    sub = next(x for x in lst if x["code"] == code)
    assert sub["status"] == "new" and sub["email"] == "tacgia@mail.vn" and sub["field_name"] == "Thông tin"
    f = client.get(f"{A}/submissions/{sub['id']}/file", headers=auth)
    assert f.status_code == 200 and f.content.startswith(b"PK")
    assert client.get(f"{A}/submissions/{sub['id']}/file").status_code == 401
    stored = os.listdir(os.environ["PRIVATE_DIR"])
    assert stored and all(client.get(f"/media/{n}").status_code == 404 for n in stored)  # bản thảo không công khai

    # tra cứu: đúng email+mã mới thấy; ghi chú nội bộ không lộ
    assert client.put(f"{A}/submissions/{sub['id']}", headers=auth, json={"status": "bogus"}).status_code == 422
    client.put(f"{A}/submissions/{sub['id']}", headers=auth,
               json={"status": "revision", "note_public": "Vui lòng bổ sung tài liệu tham khảo", "note_internal": "tác giả hay trễ hạn"})
    t = client.post(f"{P}/submissions/track", json={"email": "TACGIA@mail.vn", "code": code.lower()})
    assert t.status_code == 200
    body = t.json()
    assert body["status_label"] == "Cần chỉnh sửa" and body["note"].startswith("Vui lòng")
    assert "note_internal" not in body and "tác giả hay" not in t.text and "email" not in body
    assert client.post(f"{P}/submissions/track", json={"email": "khac@mail.vn", "code": code}).status_code == 404

    # biên tập viên xử lý được, nhưng chỉ admin được xóa
    client.post(f"{A}/users", headers=auth, json={"email": "bt2@t.vn", "password": "editor-pass-2", "role": "editor"})
    _, h = _login(client, "bt2@t.vn", "editor-pass-2")
    assert client.put(f"{A}/submissions/{sub['id']}", headers=h, json={"status": "accepted"}).status_code == 200
    assert client.delete(f"{A}/submissions/{sub['id']}", headers=h).status_code == 403
    assert client.delete(f"{A}/submissions/{sub['id']}", headers=auth).status_code == 204
    assert client.get(f"{A}/submissions/{sub['id']}/file", headers=auth).status_code == 404
    uid = next(u["id"] for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == "bt2@t.vn")
    client.delete(f"{A}/users/{uid}", headers=auth)


def test_contributor_cannot_read_submissions(client, auth):
    client.post(f"{A}/users", headers=auth, json={"email": "ctv2@t.vn", "password": "contrib-pass-2", "role": "contributor"})
    _, h = _login(client, "ctv2@t.vn", "contrib-pass-2")
    assert client.get(f"{A}/submissions", headers=h).status_code == 403
    uid = next(u["id"] for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == "ctv2@t.vn")
    client.delete(f"{A}/users/{uid}", headers=auth)


def test_submission_rate_limit(client):
    reset_fails()
    codes = [client.post(f"{P}/submissions", data=_form(title=f"Bài số {i} chống spam"), files={"file": DOCX}).status_code for i in range(6)]
    assert codes == [201] * 5 + [429]
    reset_fails()
