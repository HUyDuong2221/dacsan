"""Quét mã độc tệp tải lên (clamd giả) và sao lưu."""
import os

import pytest

from app.security import reset_fails
from helpers import A, P, _form, _login


EICAR = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


@pytest.fixture()
def fake_clamd(monkeypatch):
    """clamd giả: PING -> PONG; SCAN <path> -> FOUND nếu tệp chứa chuỗi EICAR."""
    import socket
    import threading

    from app.config import settings

    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(8)
    port = srv.getsockname()[1]
    stop = threading.Event()

    def serve():
        while not stop.is_set():
            try:
                conn, _ = srv.accept()
            except OSError:
                return
            with conn:
                buf = b""
                while not buf.endswith(b"\0"):
                    chunk = conn.recv(4096)
                    if not chunk:
                        break
                    buf += chunk
                cmd = buf.rstrip(b"\0").decode()
                if cmd == "zPING":
                    reply = "PONG"
                elif cmd.startswith("zSCAN "):
                    path = cmd[6:]
                    with open(path, "rb") as f:
                        reply = f"{path}: Eicar-Test-Signature FOUND" if EICAR in f.read() else f"{path}: OK"
                else:
                    reply = "UNKNOWN COMMAND"
                conn.sendall(reply.encode() + b"\0")

    t = threading.Thread(target=serve, daemon=True)
    t.start()
    monkeypatch.setattr(settings, "clamav_host", "127.0.0.1")
    monkeypatch.setattr(settings, "clamav_port", port)
    yield port
    stop.set()
    srv.close()


def test_upload_malware_scan(client, auth, fake_clamd, monkeypatch):
    from app.config import settings

    media = os.environ["MEDIA_DIR"]
    before = set(os.listdir(media))
    ok = client.post(f"{A}/upload", headers=auth, files={"file": ("sach.pdf", b"%PDF-1.4 sach se", "application/pdf")})
    assert ok.status_code == 200
    bad = client.post(f"{A}/upload", headers=auth, files={"file": ("doc-hai.pdf", b"%PDF " + EICAR, "application/pdf")})
    assert bad.status_code == 422 and "Eicar-Test-Signature" in bad.json()["detail"]
    after = set(os.listdir(media))
    assert len(after - before) == 1  # tệp có mã độc đã bị xóa, chỉ còn tệp sạch
    log = client.get(f"{A}/audit-logs", headers=auth, params={"action": "malware"}).json()["items"][0]
    assert "doc-hai.pdf" in log["summary"] and log["action_label"] == "Chặn tệp có mã độc" and log["user_email"] == "admin@test.vn"
    # bản thảo tác giả gửi cũng được quét
    reset_fails()
    priv = os.environ["PRIVATE_DIR"]
    n = len(os.listdir(priv))
    r = client.post(f"{P}/submissions", data=_form(title="Bài có tệp độc hại"), files={"file": ("ban-thao.docx", b"PK" + EICAR, "application/octet-stream")})
    assert r.status_code == 422 and len(os.listdir(priv)) == n
    # máy quét không hoạt động: mặc định từ chối (fail-closed), có thể cấu hình vẫn nhận
    monkeypatch.setattr(settings, "clamav_port", 1)
    down = client.post(f"{A}/upload", headers=auth, files={"file": ("x.pdf", b"%PDF sach", "application/pdf")})
    assert down.status_code == 503 and set(os.listdir(media)) == after
    monkeypatch.setattr(settings, "clamav_fail_open", True)
    assert client.post(f"{A}/upload", headers=auth, files={"file": ("y.pdf", b"%PDF sach", "application/pdf")}).status_code == 200
    reset_fails()


def test_backups(client, auth, tmp_path, monkeypatch):
    import json

    from app.config import settings

    monkeypatch.setattr(settings, "backup_dir", str(tmp_path))
    d = client.get(f"{A}/backups", headers=auth).json()
    assert d["enabled"] and d["files"] == [] and d["stale"] is True and d["scanner"]["enabled"] is False
    (tmp_path / "dacsan-20261120-020000.tar.gz").write_bytes(b"cu")
    (tmp_path / "dacsan-20261122-020000.tar.gz").write_bytes(b"moi nhat")
    (tmp_path / "khac.txt").write_text("bo qua")
    (tmp_path / "status.json").write_text(json.dumps({"time": "2026-11-22T02:00:05+0700", "ok": True, "file": "dacsan-20261122-020000.tar.gz", "size": 8, "message": "Sao lưu thành công"}))
    d = client.get(f"{A}/backups", headers=auth).json()
    assert [f["name"] for f in d["files"]] == ["dacsan-20261122-020000.tar.gz", "dacsan-20261120-020000.tar.gz"]
    assert d["status"]["ok"] is True and d["stale"] is False
    # sao lưu ngay = ghi tệp yêu cầu cho container backup
    assert client.post(f"{A}/backups/run", headers=auth).json() == {"requested": True}
    assert (tmp_path / ".request").exists() and client.get(f"{A}/backups", headers=auth).json()["requested"] is True
    # tải về bằng link ký ngắn hạn
    assert client.post(f"{A}/backups/../../etc/passwd/download-link", headers=auth).status_code in (404, 405)
    assert client.post(f"{A}/backups/khac.txt/download-link", headers=auth).status_code == 404
    link = client.post(f"{A}/backups/dacsan-20261122-020000.tar.gz/download-link", headers=auth).json()
    r = client.get(link["url"])
    assert r.status_code == 200 and r.content == b"moi nhat" and "attachment" in r.headers["content-disposition"]
    assert client.get(f"{A}/backups/download", params={"token": "rac"}).status_code == 403
    # token đăng nhập không dùng làm link tải; link tải không dùng làm phiên đăng nhập
    assert client.get(f"{A}/backups/download", params={"token": auth["Authorization"][7:]}).status_code == 403
    tok = link["url"].split("token=")[1]
    assert client.get(f"{A}/auth/me", headers={"Authorization": f"Bearer {tok}"}).status_code == 401
    dl = client.get(f"{A}/audit-logs", headers=auth, params={"entity": "backups", "action": "download"}).json()["items"][0]
    assert dl["summary"] == "dacsan-20261122-020000.tar.gz" and dl["user_email"] == "admin@test.vn"
    # chỉ quản trị viên
    client.post(f"{A}/users", headers=auth, json={"email": "bt9@t.vn", "password": "editor-pass-9", "role": "editor"})
    _, he = _login(client, "bt9@t.vn", "editor-pass-9")
    assert client.get(f"{A}/backups", headers=he).status_code == 403
    assert client.post(f"{A}/backups/run", headers=he).status_code == 403
    assert client.post(f"{A}/backups/dacsan-20261122-020000.tar.gz/download-link", headers=he).status_code == 403
    uid = next(u["id"] for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == "bt9@t.vn")
    client.delete(f"{A}/users/{uid}", headers=auth)
