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
    assert len(d["issues"]) == 8


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
    assert client.get(f"{A}/articles").status_code == 401
    assert client.post(f"{A}/auth/login", json={"email": "x@y.z", "password": "no"}).status_code == 401


def test_admin_article_crud_and_publish(client, auth):
    issue_id = client.get(f"{A}/issues", headers=auth).json()[0]["id"]
    r = client.post(f"{A}/articles", headers=auth, json={"issue_id": issue_id, "title": "Bài thử nghiệm", "status": "draft"})
    assert r.status_code == 201, r.text
    art = r.json()
    assert art["slug"] == "bai-thu-nghiem"
    assert client.get(f"{P}/articles/{art['slug']}").status_code == 404  # bản nháp không lộ ra public
    r = client.put(f"{A}/articles/{art['id']}", headers=auth, json={"status": "published", "body": "## Mục\n\nNội dung"})
    assert r.status_code == 200
    assert client.get(f"{P}/articles/{art['slug']}").json()["has_fulltext"] is True
    assert client.delete(f"{A}/articles/{art['id']}", headers=auth).status_code == 204


def test_admin_validation(client, auth):
    assert client.post(f"{A}/articles", headers=auth, json={"title": "thiếu issue"}).status_code == 422
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
    client.post(f"{A}/articles", headers=auth, json={"issue_id": n["id"], "title": "con"})
    assert client.delete(f"{A}/issues/{n['id']}", headers=auth).status_code == 204
    assert client.get(f"{A}/articles", headers=auth, params={"issue_id": n["id"]}).json() == []
