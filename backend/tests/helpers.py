"""Hằng số và hàm dùng chung cho các file test."""
from datetime import date, timedelta

from app.security import reset_fails

P = "/api/v1/public"
A = "/api/v1/admin"
DOCX = ("ban-thao.docx", b"PK\x03\x04 noi dung ban thao", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")


def _login(client, email, pw):
    reset_fails()
    r = client.post(f"{A}/auth/login", json={"email": email, "password": pw})
    return r, ({"Authorization": f"Bearer {r.json()['token']}"} if r.status_code == 200 else None)


def _form(**kw):
    d = {"name": "Nguyễn Văn A", "email": "Tacgia@Mail.vn", "title": "Bài nghiên cứu thử nghiệm",
         "abstract": "Đây là phần tóm tắt dài hơn ba mươi ký tự để qua kiểm tra.", "consent": "true",
         "organization": "ĐH X", "field_name": "Thông tin"}
    d.update(kw)
    return d


def _new_submission(client, auth, title="Bài thử quy trình phản biện"):
    reset_fails()
    code = client.post(f"{P}/submissions", data=_form(title=title), files={"file": DOCX}).json()["code"]
    return next(x for x in client.get(f"{A}/submissions", headers=auth).json() if x["code"] == code)


def _due(days=14):
    return (date.today() + timedelta(days=days)).isoformat()
