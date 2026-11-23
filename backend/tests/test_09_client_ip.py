"""IP thật của người dùng sau proxy; giới hạn đăng nhập theo tài khoản."""
from app.security import reset_fails
from helpers import A


def _req(host, xff=None):
    from starlette.requests import Request

    headers = [(b"x-forwarded-for", xff.encode())] if xff else []
    return Request({"type": "http", "method": "GET", "path": "/", "headers": headers, "client": (host, 1234)})


def test_client_ip_behind_proxy(monkeypatch):
    from app.config import settings
    from app.security import client_ip

    assert client_ip(_req("172.18.0.5", "203.0.113.9")) == "203.0.113.9"  # qua container frontend
    assert client_ip(_req("172.18.0.5", "1.1.1.1, 203.0.113.9")) == "203.0.113.9"  # phần bên trái do client tự gửi: bỏ
    assert client_ip(_req("172.18.0.5")) == "172.18.0.5"  # không có header
    assert client_ip(_req("8.8.8.8", "1.1.1.1")) == "8.8.8.8"  # gọi thẳng từ ngoài: không tin header
    monkeypatch.setattr(settings, "forwarded_hops", 0)
    assert client_ip(_req("172.18.0.5", "203.0.113.9")) == "172.18.0.5"
    monkeypatch.setattr(settings, "forwarded_hops", 2)
    assert client_ip(_req("127.0.0.1", "203.0.113.9, 10.0.0.2")) == "203.0.113.9"


def test_login_failures_also_limited_per_account(client):
    from app.security import account_limiter

    reset_fails()
    for _ in range(3):
        assert client.post(f"{A}/auth/login", json={"email": "Admin@Test.vn", "password": "sai"}).status_code == 401
    assert len(account_limiter.hits["admin@test.vn"]) == 3  # theo email (đã chuẩn hóa), không theo IP
    reset_fails()
    assert not account_limiter.hits
