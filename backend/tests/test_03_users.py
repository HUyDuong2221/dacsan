"""Người dùng và phân quyền."""
from helpers import A, _login


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
