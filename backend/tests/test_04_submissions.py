"""Gửi bài, tra cứu, giới hạn gửi."""
import os

from app.security import reset_fails
from helpers import A, DOCX, P, _form, _login


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
    n_new = sum(1 for x in lst if x["status"] == "new")
    assert client.get(f"{A}/submissions/count", headers=auth).json() == {"status": "new", "count": n_new}
    assert client.get(f"{A}/submissions/count").status_code == 401
    f = client.get(f"{A}/submissions/{sub['id']}/file", headers=auth)
    assert f.status_code == 200 and f.content.startswith(b"PK")
    assert client.get(f"{A}/submissions/{sub['id']}/file").status_code == 401
    stored = os.listdir(os.environ["PRIVATE_DIR"])
    assert stored and all(client.get(f"/media/{n}").status_code == 404 for n in stored)  # bản thảo không công khai

    # tra cứu: đúng email+mã mới thấy; ghi chú nội bộ không lộ
    assert client.put(f"{A}/submissions/{sub['id']}", headers=auth, json={"status": "bogus"}).status_code == 422
    # đổi trạng thái chỉ qua quyết định biên tập, không qua PUT
    assert client.put(f"{A}/submissions/{sub['id']}", headers=auth, json={"status": "revision"}).status_code == 422
    client.put(f"{A}/submissions/{sub['id']}", headers=auth,
               json={"note_public": "Vui lòng bổ sung tài liệu tham khảo", "note_internal": "tác giả hay trễ hạn"})
    for st in ("reviewing", "revision"):
        assert client.post(f"{A}/submissions/{sub['id']}/decision", headers=auth, json={"status": st, "note": "ok"}).status_code == 200
    t = client.post(f"{P}/submissions/track", json={"email": "TACGIA@mail.vn", "code": code.lower()})
    assert t.status_code == 200
    body = t.json()
    assert body["status_label"] == "Yêu cầu sửa" and body["note"].startswith("Vui lòng")
    assert client.get(f"{A}/submissions/count", headers=auth).json()["count"] == n_new - 1  # đã xử lý thì hết là "mới"
    assert "note_internal" not in body and "tác giả hay" not in t.text and "email" not in body
    assert client.post(f"{P}/submissions/track", json={"email": "khac@mail.vn", "code": code}).status_code == 404

    # biên tập viên xử lý được, nhưng chỉ admin được xóa
    client.post(f"{A}/users", headers=auth, json={"email": "bt2@t.vn", "password": "editor-pass-2", "role": "editor"})
    _, h = _login(client, "bt2@t.vn", "editor-pass-2")
    assert client.post(f"{A}/submissions/{sub['id']}/decision", headers=h,
                       json={"status": "reviewing", "note": "Tác giả đã gửi bản sửa"}).status_code == 200
    assert client.delete(f"{A}/submissions/{sub['id']}", headers=h).status_code == 403
    assert client.delete(f"{A}/submissions/{sub['id']}", headers=auth).status_code == 204
    assert client.get(f"{A}/submissions/{sub['id']}/file", headers=auth).status_code == 404
    uid = next(u["id"] for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == "bt2@t.vn")
    client.delete(f"{A}/users/{uid}", headers=auth)


def test_contributor_cannot_read_submissions(client, auth):
    client.post(f"{A}/users", headers=auth, json={"email": "ctv2@t.vn", "password": "contrib-pass-2", "role": "contributor"})
    _, h = _login(client, "ctv2@t.vn", "contrib-pass-2")
    assert client.get(f"{A}/submissions", headers=h).status_code == 403
    assert client.get(f"{A}/submissions/count", headers=h).status_code == 403
    uid = next(u["id"] for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == "ctv2@t.vn")
    client.delete(f"{A}/users/{uid}", headers=auth)


def test_submission_rate_limit(client):
    reset_fails()
    codes = [client.post(f"{P}/submissions", data=_form(title=f"Bài số {i} chống spam"), files={"file": DOCX}).status_code for i in range(6)]
    assert codes == [201] * 5 + [429]
    reset_fails()
