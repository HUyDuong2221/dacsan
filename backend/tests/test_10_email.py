"""Email: hộp thư đi, quên mật khẩu, đăng ký chờ duyệt, nhận tin, thư báo số mới."""
import re as _re

from app.security import reset_fails
from helpers import A, P, _login


def _outbox(client, auth, **params):
    return client.get(f"{A}/outbox", headers=auth, params=params).json()["items"]


def _mail_body(client, auth, oid):
    return client.get(f"{A}/outbox/{oid}", headers=auth).json()["body_text"]


class FakeSMTP:
    sent: list = []
    fail_send = False

    def __init__(self, host, port, timeout=None, context=None):
        self.host, self.port = host, port

    def starttls(self, context=None):
        pass

    def login(self, user, pw):
        pass

    def send_message(self, msg):
        if FakeSMTP.fail_send:
            raise OSError("550 hộp thư không tồn tại")
        FakeSMTP.sent.append(msg)

    def quit(self):
        pass


def _smtp_on(monkeypatch):
    from app.config import settings

    FakeSMTP.sent, FakeSMTP.fail_send = [], False
    monkeypatch.setattr(settings, "smtp_host", "smtp.test")
    monkeypatch.setattr(settings, "smtp_from", "dacsan@test.vn")
    monkeypatch.setattr("smtplib.SMTP", FakeSMTP)


def test_forgot_and_reset_password(client, auth):
    reset_fails()
    client.post(f"{A}/users", headers=auth, json={"email": "quen@t.vn", "password": "mat-khau-cu-1", "role": "editor"})
    generic = client.post(f"{A}/auth/forgot-password", json={"email": "khong-co@t.vn"})
    assert generic.status_code == 200
    n = len(_outbox(client, auth, kind="reset_password"))
    r = client.post(f"{A}/auth/forgot-password", json={"email": "QUEN@t.vn"})
    assert r.json() == generic.json()  # không tiết lộ email có tài khoản hay không
    rows = _outbox(client, auth, kind="reset_password")
    assert len(rows) == n + 1 and rows[0]["to_email"] == "quen@t.vn" and rows[0]["status"] == "unconfigured"
    body = _mail_body(client, auth, rows[0]["id"])
    tok = _re.search(r"dat-lai-mat-khau\?token=([\w.\-]+)", body).group(1)
    assert client.post(f"{A}/auth/reset-password", json={"token": tok, "password": "ngan"}).status_code == 422
    assert client.get(f"{A}/auth/me", headers={"Authorization": f"Bearer {tok}"}).status_code == 401  # không phải phiên đăng nhập
    assert client.post(f"{A}/auth/reset-password", json={"token": tok, "password": "mat-khau-moi-2"}).status_code == 200
    assert client.post(f"{A}/auth/reset-password", json={"token": tok, "password": "mat-khau-moi-3"}).status_code == 400  # dùng 1 lần
    assert client.post(f"{A}/auth/login", json={"email": "quen@t.vn", "password": "mat-khau-cu-1"}).status_code == 401
    reset_fails()
    assert client.post(f"{A}/auth/login", json={"email": "quen@t.vn", "password": "mat-khau-moi-2"}).status_code == 200
    acts = [x["action"] for x in client.get(f"{A}/audit-logs", headers=auth, params={"entity": "auth", "limit": 10}).json()["items"]]
    assert "reset_password" in acts and "forgot_password" in acts
    uid = next(u["id"] for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == "quen@t.vn")
    client.delete(f"{A}/users/{uid}", headers=auth)
    reset_fails()


def test_admin_sends_reset_link(client, auth):
    reset_fails()
    client.post(f"{A}/users", headers=auth, json={"email": "rs@t.vn", "password": "mat-khau-cu-1", "role": "editor"})
    uid = next(u["id"] for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == "rs@t.vn")
    r = client.post(f"{A}/users/{uid}/reset-link", headers=auth)
    assert r.status_code == 200 and "dat-lai-mat-khau?token=" in r.json()["link"]
    tok = r.json()["link"].split("token=")[1]
    assert client.post(f"{A}/auth/reset-password", json={"token": tok, "password": "mat-khau-moi-9"}).status_code == 200
    assert client.post(f"{A}/users/999999/reset-link", headers=auth).status_code == 404
    client.put(f"{A}/users/{uid}", headers=auth, json={"is_active": False})
    assert client.post(f"{A}/users/{uid}/reset-link", headers=auth).status_code == 422
    client.delete(f"{A}/users/{uid}", headers=auth)
    reset_fails()


def test_self_register_pending_approval(client, auth):
    reset_fails()
    R = f"{A}/auth/register"
    assert client.post(R, json={"email": "sai", "full_name": "Ai Đó", "password": "mat-khau-dk-1"}).status_code == 422
    assert client.post(R, json={"email": "dk@t.vn", "full_name": "Ai Đó", "password": "ngan"}).status_code == 422
    ok = client.post(R, json={"email": "DK@t.vn", "full_name": "  Người   Đăng Ký ", "password": "mat-khau-dk-1", "note": "ĐH Đà Nẵng"})
    assert ok.status_code == 201
    u = next(x for x in client.get(f"{A}/users", headers=auth).json() if x["email"] == "dk@t.vn")
    assert u["pending"] and not u["is_active"] and u["role"] == "contributor" and u["full_name"] == "Người Đăng Ký"
    assert u["status_label"] == "Chờ duyệt"
    note = _outbox(client, auth, kind="register_admin")[0]
    assert note["to_email"] == "admin@test.vn" and "Người Đăng Ký" in note["subject"]
    assert "ĐH Đà Nẵng" in _mail_body(client, auth, note["id"])
    login = client.post(f"{A}/auth/login", json={"email": "dk@t.vn", "password": "mat-khau-dk-1"})
    assert login.status_code == 401 and "chờ" in login.json()["detail"]
    # đăng ký trùng email: trả như bình thường, không tạo thêm, không đổi mật khẩu
    assert client.post(R, json={"email": "dk@t.vn", "full_name": "Kẻ Khác", "password": "mat-khau-khac-9"}).status_code == 201
    assert sum(1 for x in client.get(f"{A}/users", headers=auth).json() if x["email"] == "dk@t.vn") == 1
    # ô bẫy bot
    client.post(R, json={"email": "bot@t.vn", "full_name": "Bot", "password": "mat-khau-bot-1", "website": "http://spam"})
    assert all(x["email"] != "bot@t.vn" for x in client.get(f"{A}/users", headers=auth).json())
    # duyệt = tick Đang hoạt động
    d = client.put(f"{A}/users/{u['id']}", headers=auth, json={"is_active": True}).json()
    assert d["pending"] is False and d["status_label"] == "Đang hoạt động"
    assert _outbox(client, auth, kind="account_approved")[0]["to_email"] == "dk@t.vn"
    reset_fails()
    assert client.post(f"{A}/auth/login", json={"email": "dk@t.vn", "password": "mat-khau-dk-1"}).status_code == 200
    client.delete(f"{A}/users/{u['id']}", headers=auth)
    reset_fails()


def test_subscribe_confirm_notify_unsubscribe(client, auth):
    reset_fails()
    S = f"{P}/subscribe"
    assert client.post(S, json={"email": "khong-hop-le"}).status_code == 422
    assert client.post(S, json={"email": "Doc.Gia@t.vn"}).json()["ok"]
    sub = next(x for x in client.get(f"{A}/subscribers", headers=auth).json() if x["email"] == "doc.gia@t.vn")
    assert sub["confirmed"] is False and "token" not in sub
    body = _mail_body(client, auth, _outbox(client, auth, kind="subscribe_confirm")[0]["id"])
    tok = _re.search(r"xac-nhan-dang-ky\?token=([\w\-]+)", body).group(1)
    assert client.post(f"{P}/subscribe/confirm", json={"token": "x" * 30}).status_code == 404
    c = client.post(f"{P}/subscribe/confirm", json={"token": tok})
    assert c.status_code == 200 and c.json()["email"].endswith("@t.vn") and "doc.gia" not in c.json()["email"]
    confirmed = [x for x in client.get(f"{A}/subscribers", headers=auth).json() if x["confirmed"]]

    def new_issue_mails():
        return _outbox(client, auth, kind="new_issue", limit=200)

    n0 = len(new_issue_mails())
    iss = client.post(f"{A}/issues", headers=auth, json={"number": 970, "theme": "Số thư báo", "published_at": "2026-11-01"}).json()
    assert iss["notified_at"] is None and len(new_issue_mails()) == n0  # chưa công bố: chưa gửi
    client.post(f"{A}/toc-entries", headers=auth, json={"issue_id": iss["id"], "title": "Bài trong số thư báo", "author": "Tác Giả A"})
    # công bố lần đầu: tự gửi thư báo tới mọi người đã xác nhận
    d = client.put(f"{A}/issues/{iss['id']}", headers=auth, json={"published": True}).json()
    assert d["notified_at"]
    mails = new_issue_mails()
    assert len(mails) - n0 == len(confirmed)
    mine = next(m for m in mails if m["to_email"] == "doc.gia@t.vn")
    body = _mail_body(client, auth, mine["id"])
    assert iss["label"] in mine["subject"] and "Bài trong số thư báo (Tác Giả A)" in body
    log = client.get(f"{A}/audit-logs", headers=auth, params={"entity": "issues", "limit": 1}).json()["items"][0]
    assert "gửi thư báo số mới" in log["summary"]
    # sửa số đã công bố, bỏ công bố rồi công bố lại: không gửi lại
    client.put(f"{A}/issues/{iss['id']}", headers=auth, json={"summary": "Sửa phần giới thiệu"})
    client.put(f"{A}/issues/{iss['id']}", headers=auth, json={"published": False})
    client.put(f"{A}/issues/{iss['id']}", headers=auth, json={"published": True})
    assert len(new_issue_mails()) == len(mails)
    # tạo số và công bố ngay cũng tự gửi
    iss2 = client.post(f"{A}/issues", headers=auth, json={"number": 971, "theme": "Số công bố ngay", "published_at": "2026-11-02", "published": True}).json()
    assert iss2["notified_at"] and len(new_issue_mails()) == len(mails) + len(confirmed)
    # endpoint gửi tay cũ đã bỏ
    assert client.post(f"{A}/issues/{iss['id']}/notify", headers=auth, json={}).status_code in (404, 405)
    unsub = _re.search(r"huy-dang-ky\?token=([\w\-]+)", body).group(1)
    # hủy đăng ký
    assert client.post(f"{P}/unsubscribe", json={"token": unsub}).status_code == 200
    assert client.post(f"{P}/unsubscribe", json={"token": unsub}).status_code == 404
    assert all(x["email"] != "doc.gia@t.vn" for x in client.get(f"{A}/subscribers", headers=auth).json())
    for i in (iss, iss2):
        client.delete(f"{A}/issues/{i['id']}", headers=auth)
    reset_fails()


def test_smtp_delivery_and_outbox(client, auth, monkeypatch):
    _smtp_on(monkeypatch)
    assert client.get(f"{A}/outbox/config", headers=auth).json()["configured"] is True
    assert "password" not in client.get(f"{A}/outbox/config", headers=auth).text.lower()
    assert client.post(f"{A}/outbox/test", headers=auth, json={"to": "sai"}).status_code == 422
    t = client.post(f"{A}/outbox/test", headers=auth, json={"to": "nhan@t.vn"})
    assert t.status_code == 200
    row = client.get(f"{A}/outbox/{t.json()['id']}", headers=auth).json()
    assert row["status"] == "sent" and row["sent_at"] and row["attempts"] == 1  # gửi nền sau khi trả về
    msg = FakeSMTP.sent[-1]
    assert msg["To"] == "nhan@t.vn" and "dacsan@test.vn" in msg["From"] and msg.get_body(("html",)) is not None
    # gửi lỗi -> failed, gửi lại được
    FakeSMTP.fail_send = True
    t2 = client.post(f"{A}/outbox/test", headers=auth, json={"to": "loi@t.vn"}).json()
    r2 = client.get(f"{A}/outbox/{t2['id']}", headers=auth).json()
    assert r2["status"] == "failed" and "550" in r2["error"]
    FakeSMTP.fail_send = False
    assert client.post(f"{A}/outbox/{t2['id']}/resend", headers=auth).status_code == 200
    assert client.get(f"{A}/outbox/{t2['id']}", headers=auth).json()["status"] == "sent"
    assert client.post(f"{A}/outbox/{t2['id']}/resend", headers=auth).status_code == 409  # đã gửi
    # tiêu đề không thể chèn header; dữ liệu người dùng được escape trong HTML
    reset_fails()
    client.post(f"{A}/auth/register", json={"email": "x@t.vn", "full_name": "<b>X</b>\r\nBcc: evil@x.vn", "password": "mat-khau-x-12"})
    m = FakeSMTP.sent[-1]
    assert "\n" not in m["Subject"] and m["Bcc"] is None
    assert "<b>X</b>" not in m.get_body(("html",)).get_content() and "&lt;b&gt;X&lt;/b&gt;" in m.get_body(("html",)).get_content()
    # quyền
    client.post(f"{A}/users", headers=auth, json={"email": "bt8@t.vn", "password": "editor-pass-8", "role": "editor"})
    _, he = _login(client, "bt8@t.vn", "editor-pass-8")
    assert client.get(f"{A}/outbox", headers=he).status_code == 403
    assert client.post(f"{A}/outbox/test", headers=he, json={"to": "a@t.vn"}).status_code == 403
    for e in ("bt8@t.vn", "x@t.vn"):
        uid = next(u["id"] for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == e)
        client.delete(f"{A}/users/{uid}", headers=auth)
    reset_fails()
