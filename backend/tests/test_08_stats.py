"""Thống kê: lượt xem/đọc/tải, bài gửi, xuất Excel."""
from helpers import A, P, _login, _new_submission


def test_view_tracking(client, auth):
    from app.routers.stats import reset_dedup

    reset_dedup()
    slug = "so-17-6-2026"
    art = client.get(f"{P}/issues/{slug}").json()["groups"][0]["items"][0]["slug"]
    before = client.get(f"{A}/stats", headers=auth).json()["traffic"]["totals"]
    T = f"{P}/track"
    assert client.post(T, json={"kind": "view", "issue": slug}).status_code == 204
    client.post(T, json={"kind": "view", "issue": slug})  # cùng IP, cùng mục: không đếm lại
    client.post(T, json={"kind": "view", "issue": slug}, headers={"User-Agent": "Googlebot/2.1"})  # bot
    client.post(T, json={"kind": "like", "issue": slug})  # loại không hợp lệ
    client.post(T, json={"kind": "view", "issue": "khong-co-so-nay"})
    client.post(T, json={"kind": "view", "issue": slug, "article": "bai-khong-ton-tai"})
    client.post(T, json={"kind": "view", "issue": slug, "article": art})
    client.post(T, json={"kind": "read", "issue": slug})
    client.post(T, json={"kind": "download", "issue": slug, "article": art})
    after = client.get(f"{A}/stats", headers=auth).json()
    tot = after["traffic"]["totals"]
    # xem: 1 trang số + 1 trang bài; đọc: 1; tải: 1 (tính cho số, không cộng trùng phần của bài)
    assert (tot["view"] - before["view"], tot["read"] - before["read"], tot["download"] - before["download"]) == (2, 1, 1)
    top_a = next(a for a in after["traffic"]["top_articles"] if a["slug"] == art)
    assert (top_a["view"], top_a["download"]) == (1, 1) and top_a["issue"] == "Số 17 (6-2026)"
    top_i = next(i for i in after["traffic"]["top_issues"] if i["slug"] == slug)
    assert (top_i["view"], top_i["read"], top_i["download"]) == (1, 1, 1)
    today = after["range"]["to"]
    assert next(d for d in after["traffic"]["daily"] if d["day"] == today)["view"] >= 2
    # số chưa công bố không được đếm
    iss = client.post(f"{A}/issues", headers=auth, json={"number": 960, "theme": "Chưa công bố", "published_at": "2026-10-01"}).json()
    client.post(T, json={"kind": "view", "issue": iss["slug"]})
    assert all(i["slug"] != iss["slug"] for i in client.get(f"{A}/stats", headers=auth).json()["traffic"]["top_issues"])
    client.delete(f"{A}/issues/{iss['id']}", headers=auth)
    reset_dedup()


def test_submission_stats_and_roles(client, auth):
    base = client.get(f"{A}/stats", headers=auth).json()["submissions"]
    s1 = _new_submission(client, auth, "Bài thống kê được chấp nhận")
    s2 = _new_submission(client, auth, "Bài thống kê bị từ chối")
    _new_submission(client, auth, "Bài thống kê chưa xử lý")
    for st in ("reviewing", "approved"):
        client.post(f"{A}/submissions/{s1['id']}/decision", headers=auth, json={"status": st, "note": st})
    client.post(f"{A}/submissions/{s2['id']}/decision", headers=auth, json={"status": "rejected", "note": "Ngoài phạm vi"})
    d = client.get(f"{A}/stats", headers=auth).json()["submissions"]
    assert d["total"] - base["total"] == 3
    assert d["accepted"] - base["accepted"] == 1 and d["rejected"] - base["rejected"] == 1
    assert d["acceptance_rate"] is not None and 0 < d["acceptance_rate"] <= 100
    assert d["avg_decision_days"] is not None and d["avg_decision_days"] >= 0 and d["avg_first_response_days"] is not None
    assert sum(m["total"] for m in d["by_month"]) == d["total"]
    assert sum(x["count"] for x in d["by_status"]) == d["total"]
    # khoảng ngày
    assert client.get(f"{A}/stats", headers=auth, params={"date_from": "2000-01-01", "date_to": "2000-01-31"}).json()["submissions"]["total"] == 0
    assert client.get(f"{A}/stats", headers=auth, params={"date_from": "2026-02-01", "date_to": "2026-01-01"}).status_code == 422
    # quyền: biên tập viên xem được, cộng tác viên và khách thì không
    assert client.get(f"{A}/stats").status_code == 401
    client.post(f"{A}/users", headers=auth, json={"email": "ctv7@t.vn", "password": "contrib-pass-7", "role": "contributor"})
    _, h = _login(client, "ctv7@t.vn", "contrib-pass-7")
    assert client.get(f"{A}/stats", headers=h).status_code == 403
    assert client.get(f"{A}/stats/export", headers=h).status_code == 403
    uid = next(u["id"] for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == "ctv7@t.vn")
    client.delete(f"{A}/users/{uid}", headers=auth)


def test_stats_export_excel(client, auth):
    import io

    from openpyxl import load_workbook

    _new_submission(client, auth, '=HYPERLINK("http://evil.example","bấm")')
    r = client.get(f"{A}/stats/export", headers=auth)
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert "attachment" in r.headers["content-disposition"] and ".xlsx" in r.headers["content-disposition"]
    wb = load_workbook(io.BytesIO(r.content))
    assert wb.sheetnames == ["Tổng quan", "Bài gửi theo tháng", "Bài gửi theo trạng thái", "Bài gửi",
                             "Lượt theo bài", "Lượt theo số", "Lượt theo ngày"]
    ws = wb["Bài gửi"]
    assert [c.value for c in ws[1]][:3] == ["Mã", "Ngày gửi", "Tiêu đề"]
    cell = next(row[2] for row in ws.iter_rows(min_row=2) if str(row[2].value).startswith("=HYPERLINK"))
    assert cell.data_type == "s"  # văn bản, không phải công thức
    assert wb["Tổng quan"]["A1"].value == "Chỉ số"
