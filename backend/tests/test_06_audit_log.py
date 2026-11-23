"""Nhật ký hoạt động."""
from app.security import reset_fails
from helpers import A, _login


def _audit(client, auth, **params):
    r = client.get(f"{A}/audit-logs", headers=auth, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def test_audit_log_records_admin_actions(client, auth):
    reset_fails()
    assert client.post(f"{A}/auth/login", json={"email": "admin@test.vn", "password": "sai-mat-khau"}).status_code == 401
    assert client.post(f"{A}/auth/login", json={"email": "admin@test.vn", "password": "secret-pass"}).status_code == 200
    reset_fails()
    fail = _audit(client, auth, action="login_failed")["items"][0]
    assert fail["user_email"] == "admin@test.vn" and fail["action_label"] == "Đăng nhập thất bại" and fail["status_code"] == 401
    ok = _audit(client, auth, action="login")["items"][0]
    assert ok["user_id"] and ok["user_email"] == "admin@test.vn"

    f = client.post(f"{A}/fields", headers=auth, json={"name": "Chuyên mục nhật ký", "sort_order": 50}).json()
    client.put(f"{A}/fields/{f['id']}", headers=auth, json={"name": "Chuyên mục nhật ký 2"})
    client.delete(f"{A}/fields/{f['id']}", headers=auth)
    rows = _audit(client, auth, entity="fields", limit=3)["items"]
    assert [(r["action"], r["summary"]) for r in rows] == [
        ("delete", "Chuyên mục nhật ký 2"), ("update", "Chuyên mục nhật ký 2"), ("create", "Chuyên mục nhật ký")]
    assert all(r["entity_id"] == str(f["id"]) and r["entity_label"] == "Chuyên mục" and r["user_email"] == "admin@test.vn" for r in rows)

    # request lỗi và thao tác chỉ đọc không ghi nhật ký
    n = _audit(client, auth)["total"]
    assert client.post(f"{A}/fields", headers=auth, json={}).status_code == 422
    client.get(f"{A}/fields", headers=auth)
    assert _audit(client, auth)["total"] == n
    # lọc theo từ khóa, ngày
    assert _audit(client, auth, q="nhật ký 2")["total"] >= 2
    assert _audit(client, auth, date_from="2000-01-01", date_to="2000-01-02")["total"] == 0
    opts = client.get(f"{A}/audit-logs/options", headers=auth).json()
    assert "admin@test.vn" in opts["users"] and any(e["value"] == "issues" for e in opts["entities"])


def test_audit_log_admin_only(client, auth):
    client.post(f"{A}/users", headers=auth, json={"email": "bt4@t.vn", "password": "editor-pass-4", "role": "editor"})
    _, he = _login(client, "bt4@t.vn", "editor-pass-4")
    assert client.get(f"{A}/audit-logs", headers=he).status_code == 403
    assert client.get(f"{A}/audit-logs").status_code == 401
    row = _audit(client, auth, entity="users", action="create")["items"][0]
    assert row["summary"] == "bt4@t.vn (editor)"
    uid = next(u["id"] for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == "bt4@t.vn")
    client.delete(f"{A}/users/{uid}", headers=auth)
    assert _audit(client, auth, entity="users", action="delete")["items"][0]["summary"] == "bt4@t.vn"
