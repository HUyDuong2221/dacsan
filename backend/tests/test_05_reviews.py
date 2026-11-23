"""Phản biện, quyết định biên tập, lịch sử, đưa bài đã nhận đăng vào mục lục."""
from helpers import A, P, _due, _login, _new_submission


def test_assign_reviewer_and_remind(client, auth):
    sub = _new_submission(client, auth)
    sid = sub["id"]
    base = f"{A}/submissions/{sid}/reviews"
    bad = [
        {"reviewer_name": "", "reviewer_email": "pb@uni.vn", "due_date": _due()},
        {"reviewer_name": "TS. Phản Biện", "reviewer_email": "sai-email", "due_date": _due()},
        {"reviewer_name": "TS. Phản Biện", "reviewer_email": "pb@uni.vn", "due_date": _due(-1)},
    ]
    for b in bad:
        assert client.post(base, headers=auth, json=b).status_code == 422
    r = client.post(base, headers=auth, json={"reviewer_name": "TS. Phản Biện", "reviewer_email": "PB@uni.vn", "due_date": _due()})
    assert r.status_code == 201, r.text
    rv = r.json()
    assert rv["status"] == "invited" and rv["reviewer_email"] == "pb@uni.vn"
    assert rv["review_url"] == f"/phan-bien/{rv['token']}" and len(rv["token"]) >= 40
    # trùng phản biện viên đang mở
    dup = {"reviewer_name": "TS. Phản Biện", "reviewer_email": "pb@uni.vn", "due_date": _due()}
    assert client.post(base, headers=auth, json=dup).status_code == 409
    # bài tự chuyển sang Phân công phản biện
    s = next(x for x in client.get(f"{A}/submissions", headers=auth).json() if x["id"] == sid)
    assert s["status"] == "in_review" and s["status_label"] == "Phân công phản biện"
    lst = client.get(base, headers=auth).json()
    assert len(lst) == 1 and "token" not in lst[0] and "token_hash" not in lst[0]
    # nhắc hạn
    for n in (1, 2):
        d = client.post(f"{base}/{rv['id']}/remind", headers=auth).json()
        assert d["reminder_count"] == n and d["last_reminded_at"]
    assert client.post(f"{A}/submissions/{sid}/reviews/999999/remind", headers=auth).status_code == 404
    hist = client.get(f"{A}/submissions/{sid}/history", headers=auth).json()
    assert [h["to_status"] for h in hist] == ["new", "in_review", "in_review", "in_review"]
    assert hist[0]["from_status"] is None and hist[0]["note"] == "Tác giả gửi bài"
    assert hist[1]["from_status"] == "new" and "TS. Phản Biện" in hist[1]["note"] and hist[1]["changed_by_name"]
    assert "Nhắc hạn phản biện lần 2" in hist[3]["note"]
    # tạo lại link: link cũ hết hiệu lực
    new = client.post(f"{base}/{rv['id']}/link", headers=auth).json()
    assert client.get(f"{P}/reviews/{rv['token']}").status_code == 404
    assert client.get(f"{P}/reviews/{new['token']}").status_code == 200


def test_review_submit_by_token(client, auth):
    sub = _new_submission(client, auth, "Bài thử nộp đánh giá bằng token")
    sid = sub["id"]
    rv = client.post(f"{A}/submissions/{sid}/reviews", headers=auth,
                     json={"reviewer_name": "PGS. Đánh Giá", "reviewer_email": "dg@uni.vn", "due_date": _due()}).json()
    tok = rv["token"]
    assert client.get(f"{P}/reviews/khong-phai-token-hop-le-123456").status_code == 404
    pub = client.get(f"{P}/reviews/{tok}")
    assert pub.status_code == 200
    d = pub.json()
    assert d["submission"]["title"] == "Bài thử nộp đánh giá bằng token" and d["status"] == "invited"
    # phản biện kín: không lộ email, tên tác giả, mã tra cứu
    assert sub["email"] not in pub.text and sub["name"] not in pub.text and sub["code"] not in pub.text
    f = client.get(f"{P}/reviews/{tok}/file")
    assert f.status_code == 200 and f.content.startswith(b"PK") and sub["code"] not in f.headers["content-disposition"]
    assert client.post(f"{P}/reviews/{tok}/respond", json={"accept": True}).json()["status"] == "accepted"
    sub_url = f"{P}/reviews/{tok}/submit"
    assert client.post(sub_url, json={"recommendation": "diem-9", "comments_author": "Bài viết tốt, cần sửa nhỏ."}).status_code == 422
    assert client.post(sub_url, json={"recommendation": "minor", "comments_author": "ngắn"}).status_code == 422
    ok = client.post(sub_url, json={
        "recommendation": "minor", "comments_author": "Bài viết tốt, cần sửa nhỏ phần số liệu.", "comments_editor": "Nên nhận đăng."})
    assert ok.status_code == 200 and ok.json()["status"] == "submitted"
    assert client.post(sub_url, json={"recommendation": "accept", "comments_author": "Đổi ý, nhận đăng luôn."}).status_code == 409
    assert client.post(f"{P}/reviews/{tok}/respond", json={"accept": False}).status_code == 409
    lst = client.get(f"{A}/submissions/{sid}/reviews", headers=auth).json()
    assert lst[0]["recommendation"] == "minor" and lst[0]["recommendation_label"] == "Sửa nhỏ"
    assert lst[0]["form_data"]["comments_editor"] == "Nên nhận đăng." and lst[0]["submitted_at"]
    assert client.post(f"{A}/submissions/{sid}/reviews/{rv['id']}/remind", headers=auth).status_code == 409
    hist = client.get(f"{A}/submissions/{sid}/history", headers=auth).json()
    assert hist[-1]["note"] == "PGS. Đánh Giá đã nộp đánh giá: Sửa nhỏ" and hist[-1]["changed_by"] is None
    # phản biện viên khác từ chối thì không tải được bản thảo
    rv2 = client.post(f"{A}/submissions/{sid}/reviews", headers=auth,
                      json={"reviewer_name": "TS. Bận Việc", "reviewer_email": "ban@uni.vn", "due_date": _due()}).json()
    assert client.post(f"{P}/reviews/{rv2['token']}/respond", json={"accept": False}).json()["status"] == "declined"
    assert client.get(f"{P}/reviews/{rv2['token']}/file").status_code == 403


def test_decision_records_history(client, auth):
    sub = _new_submission(client, auth, "Bài thử quyết định biên tập")
    sid, url = sub["id"], f"{A}/submissions/{sub['id']}/decision"
    assert [x["value"] for x in sub["next_statuses"]] == ["reviewing", "rejected"]
    assert client.post(url, headers=auth, json={"status": "reviewing", "note": "   "}).status_code == 422  # bắt buộc ghi chú
    bad = client.post(url, headers=auth, json={"status": "accepted", "note": "nhảy cóc"})
    assert bad.status_code == 422 and "Mới nhận" in bad.json()["detail"]
    assert client.post(url, headers=auth, json={"status": "bogus", "note": "x"}).status_code == 422
    steps = [("reviewing", "Hồ sơ đủ, chuyển xét duyệt"), ("approved", "Hai phản biện đồng ý"), ("accepted", "Nhận đăng số 18")]
    for st, note in steps:
        r = client.post(url, headers=auth, json={"status": st, "note": note})
        assert r.status_code == 200 and r.json()["status"] == st, r.text
    assert r.json()["next_statuses"] == []
    assert client.post(url, headers=auth, json={"status": "revision", "note": "muộn"}).status_code == 422
    hist = client.get(f"{A}/submissions/{sid}/history", headers=auth).json()
    assert [(h["from_status"], h["to_status"], h["note"]) for h in hist[1:]] == [
        ("new", "reviewing", steps[0][1]), ("reviewing", "approved", steps[1][1]), ("approved", "accepted", steps[2][1])]
    assert hist[-1]["to_label"] == "Đã nhận đăng" and hist[-1]["changed_by"] and hist[-1]["changed_at"]
    # bài đã nhận đăng: không phân công phản biện thêm
    late = {"reviewer_name": "TS. Muộn", "reviewer_email": "muon@uni.vn", "due_date": _due()}
    assert client.post(f"{A}/submissions/{sid}/reviews", headers=auth, json=late).status_code == 409
    # xóa bài thì lượt phản biện và lịch sử đi theo (FK CASCADE)
    assert client.delete(f"{A}/submissions/{sid}", headers=auth).status_code == 204
    assert client.get(f"{A}/submissions/{sid}/history", headers=auth).status_code == 404


def test_review_endpoints_require_role(client, auth):
    sub = _new_submission(client, auth, "Bài thử phân quyền phản biện")
    sid = sub["id"]
    body = {"reviewer_name": "TS. A", "reviewer_email": "a@uni.vn", "due_date": _due()}
    rv = client.post(f"{A}/submissions/{sid}/reviews", headers=auth, json=body).json()
    calls = [
        ("get", f"{A}/submissions/{sid}/reviews", None),
        ("post", f"{A}/submissions/{sid}/reviews", {**body, "reviewer_email": "b@uni.vn"}),
        ("post", f"{A}/submissions/{sid}/reviews/{rv['id']}/remind", None),
        ("post", f"{A}/submissions/{sid}/reviews/{rv['id']}/link", None),
        ("post", f"{A}/submissions/{sid}/decision", {"status": "rejected", "note": "không phù hợp"}),
        ("get", f"{A}/submissions/{sid}/history", None),
        ("post", f"{A}/submissions/{sid}/toc-entry", {"issue_id": 1}),
    ]

    def call(m, u, j, headers=None):
        return client.post(u, json=j, headers=headers) if m == "post" else client.get(u, headers=headers)

    for m, u, j in calls:
        assert call(m, u, j).status_code == 401, u
    client.post(f"{A}/users", headers=auth, json={"email": "ctv3@t.vn", "password": "contrib-pass-3", "role": "contributor"})
    _, h = _login(client, "ctv3@t.vn", "contrib-pass-3")
    for m, u, j in calls:
        assert call(m, u, j, h).status_code == 403, u
    # không có gì thay đổi
    assert client.get(f"{A}/submissions/{sid}/history", headers=auth).json()[-1]["to_status"] == "in_review"
    assert len(client.get(f"{A}/submissions/{sid}/reviews", headers=auth).json()) == 1
    # biên tập viên thì được
    client.post(f"{A}/users", headers=auth, json={"email": "bt3@t.vn", "password": "editor-pass-3", "role": "editor"})
    _, he = _login(client, "bt3@t.vn", "editor-pass-3")
    assert client.post(f"{A}/submissions/{sid}/reviews/{rv['id']}/remind", headers=he).status_code == 200
    rej = client.post(f"{A}/submissions/{sid}/decision", headers=he, json={"status": "rejected", "note": "Ngoài phạm vi"})
    assert rej.status_code == 200
    for e in ("ctv3@t.vn", "bt3@t.vn"):
        uid = next(u["id"] for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == e)
        client.delete(f"{A}/users/{uid}", headers=auth)


def test_add_accepted_submission_to_toc(client, auth):
    sub = _new_submission(client, auth, "Bài thử đưa vào mục lục")
    sid, url = sub["id"], f"{A}/submissions/{sub['id']}/toc-entry"
    assert sub["toc_entry"] is None
    field = client.post(f"{A}/fields", headers=auth, json={"name": "Thông tin", "sort_order": 99})
    fid = field.json()["id"] if field.status_code == 201 else next(
        f["id"] for f in client.get(f"{A}/fields", headers=auth).json() if f["name"] == "Thông tin")
    issue = client.post(f"{A}/issues", headers=auth, json={"number": 901, "theme": "Số thử mục lục", "published": False}).json()
    pub = client.post(f"{A}/issues", headers=auth, json={"number": 902, "theme": "Số đã công bố", "published": True}).json()
    # chưa nhận đăng thì không đưa được
    assert client.post(url, headers=auth, json={"issue_id": issue["id"]}).status_code == 409
    for st in ("reviewing", "approved", "accepted"):
        client.post(f"{A}/submissions/{sid}/decision", headers=auth, json={"status": st, "note": st})
    assert client.post(url, headers=auth, json={"issue_id": 999999}).status_code == 404
    assert client.post(url, headers=auth, json={"issue_id": pub["id"]}).status_code == 409  # số đã công bố
    r = client.post(url, headers=auth, json={"issue_id": issue["id"], "page_label": "tr. 12"})
    assert r.status_code == 201, r.text
    te = r.json()["toc_entry"]
    assert te["issue_id"] == issue["id"] and te["title"] == "Bài thử đưa vào mục lục" and te["page_label"] == "tr. 12"
    assert r.json()["status"] == "accepted"  # trạng thái không đổi
    entry = next(e for e in client.get(f"{A}/toc-entries?issue_id={issue['id']}", headers=auth).json() if e["id"] == te["id"])
    assert entry["author"] == sub["name"] and entry["field_id"] == fid  # chuyên mục khớp theo tên tác giả đề xuất
    assert client.post(url, headers=auth, json={"issue_id": issue["id"]}).status_code == 409  # không đưa hai lần
    hist = client.get(f"{A}/submissions/{sid}/history", headers=auth).json()
    assert hist[-1]["note"] == f"Đưa vào mục lục {issue['label']}, chuyên mục Thông tin"
    # xóa dòng mục lục thì liên kết tự bỏ, đưa lại được
    assert client.delete(f"{A}/toc-entries/{te['id']}", headers=auth).status_code == 204
    again = next(x for x in client.get(f"{A}/submissions", headers=auth).json() if x["id"] == sid)
    assert again["toc_entry"] is None
    assert client.post(url, headers=auth, json={"issue_id": issue["id"]}).status_code == 201
    client.delete(f"{A}/issues/{issue['id']}", headers=auth)
    client.delete(f"{A}/issues/{pub['id']}", headers=auth)
