"""Cấu hình chung cho test: chạy trên SQLite tạm (đăng ký hàm unaccent giả) để không cần Postgres.

Biến môi trường phải đặt TRƯỚC khi import app. Các file test dùng chung một DB và một client trong cả phiên,
và được đánh số để chạy theo thứ tự (một số test dựa vào dữ liệu mẫu ban đầu, ví dụ test_home).
"""
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
from sqlalchemy import event  # noqa: E402

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


@pytest.fixture(scope="session")
def client():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add(User(email="admin@test.vn", password_hash=hash_password("secret-pass")))
        db.commit()
        seed(db)
    return TestClient(app)


@pytest.fixture(scope="session")
def auth(client):
    reset_fails()
    r = client.post("/api/v1/admin/auth/login", json={"email": "admin@test.vn", "password": "secret-pass"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}
