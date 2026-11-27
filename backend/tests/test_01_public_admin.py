"""Trang công khai, mục lục số, kiểm tra quyền và dữ liệu ở các mục quản trị."""
from helpers import A, P


def test_home(client):
    d = client.get(f"{P}/home").json()
    assert d["latest_issue"]["number"] == 17
    assert len(d["hero"]) == 6
    assert len(d["articles"]) == 25
    assert d["hero"][0]["href"] == "/issues/so-17-6-2026" and d["hero"][0]["excerpt"]
    assert d["hero"][1]["kicker"] == "Phạm Ngọc Linh · tr. 13"
    # 23 bài của số 17 + 25 bài mẫu ở demo_content.py (không tính trang đầu số)
    assert d["stats"] == {"issue_count": 13, "article_count": 48, "year_from": 2024, "year_to": 2026}


def test_issue_detail_groups(client):
    d = client.get(f"{P}/issues/so-17-6-2026").json()
    assert d["total"] == 25 and len(d["front"]) == 2
    assert [g["field"] for g in d["groups"]][0].startswith("Đại hội")


def test_article_fulltext_and_nav(client):
    slug = client.get(f"{P}/issues/so-17-6-2026").json()["groups"][0]["items"][0]["slug"]
    d = client.get(f"{P}/articles/{slug}").json()
    assert d["has_fulltext"] is True
    assert d["toc"][0] == "Lời dẫn" and "Kỳ vọng nhiệm kỳ mới" in d["toc"]
    assert d["citation"].startswith("Phạm Ngọc Linh (2026)")
    assert d["prev"]["slug"] and d["next"]["slug"]


def test_search_without_accents(client):
    r = client.get(f"{P}/search", params={"q": "tri thuc moi cua xu quang"}).json()
    assert r["count"] >= 1
    assert client.get(f"{P}/search", params={"q": "x"}).status_code == 422


def test_subscribe_validation(client):
    assert client.post(f"{P}/subscribe", json={"email": "bad"}).status_code == 422
    assert client.post(f"{P}/subscribe", json={"email": "a@b.vn"}).status_code == 200
    assert client.post(f"{P}/subscribe", json={"email": "A@b.vn"}).status_code == 200  # không trùng


def test_chat(client):
    assert client.post(f"{P}/chat", json={"question": "Thể lệ gửi bài?"}).json()["link"] == "/gui-bai"
    assert client.post(f"{P}/chat", json={"question": "Phạm Ngọc Linh"}).json()["articles"]


def test_admin_requires_auth(client):
    assert client.get(f"{A}/toc-entries").status_code == 401
    assert client.post(f"{A}/auth/login", json={"email": "x@y.z", "password": "no"}).status_code == 401


def test_admin_toc_entry_crud_visibility_follows_issue(client, auth):
    issue_id = client.get(f"{A}/issues", headers=auth).json()[0]["id"]  # số 17 đang công bố
    r = client.post(f"{A}/toc-entries", headers=auth, json={"issue_id": issue_id, "title": "Mục lục thử nghiệm", "page_label": "tr. 140"})
    assert r.status_code == 201, r.text
    e = r.json()
    assert e["slug"] == "muc-luc-thu-nghiem" and "status" not in e
    # là dòng mục lục: hiện ngay khi số đã công bố, chưa có toàn văn
    assert client.get(f"{P}/articles/{e['slug']}").json()["has_fulltext"] is False
    r = client.put(f"{A}/toc-entries/{e['id']}", headers=auth, json={"body": "## Mục\n\nNội dung"})
    assert r.status_code == 200
    assert client.get(f"{P}/articles/{e['slug']}").json()["has_fulltext"] is True
    assert client.delete(f"{A}/toc-entries/{e['id']}", headers=auth).status_code == 204


def test_unpublished_issue_hides_its_toc(client, auth):
    i = client.post(f"{A}/issues", headers=auth, json={"number": 88, "published_at": "2026-01-01", "theme": "ẩn"}).json()
    e = client.post(f"{A}/toc-entries", headers=auth, json={"issue_id": i["id"], "title": "Dòng ẩn"}).json()
    assert client.get(f"{P}/articles/{e['slug']}").status_code == 404
    assert client.get(f"{P}/issues/{i['slug']}").status_code == 404
    client.put(f"{A}/issues/{i['id']}", headers=auth, json={"published": True})
    assert client.get(f"{P}/issues/{i['slug']}").json()["total"] == 1
    client.delete(f"{A}/issues/{i['id']}", headers=auth)


def test_admin_validation(client, auth):
    assert client.post(f"{A}/toc-entries", headers=auth, json={"title": "thiếu issue"}).status_code == 422
    assert client.post(f"{A}/issues", headers=auth, json={"number": "abc", "label": "x", "theme": "y"}).status_code == 422
    assert client.post(f"{A}/activities", headers=auth, json={"title": "t", "event_date": "not-a-date"}).status_code == 422


def test_upload_rules(client, auth):
    bad = client.post(f"{A}/upload", headers=auth, files={"file": ("x.exe", b"MZ")})
    assert bad.status_code == 415
    ok = client.post(f"{A}/upload", headers=auth, files={"file": ("a.pdf", b"%PDF-1.4")})
    assert ok.status_code == 200
    assert client.get(ok.json()["url"]).status_code == 200


def test_delete_issue_cascades(client, auth):
    n = client.post(f"{A}/issues", headers=auth, json={"number": 99, "label": "Số 99", "theme": "t"}).json()
    client.post(f"{A}/toc-entries", headers=auth, json={"issue_id": n["id"], "title": "con"})
    assert client.delete(f"{A}/issues/{n['id']}", headers=auth).status_code == 204
    assert client.get(f"{A}/toc-entries", headers=auth, params={"issue_id": n["id"]}).json() == []


def test_issue_label_derived_from_number_and_date(client, auth):
    r = client.post(f"{A}/issues", headers=auth, json={"number": 18, "published_at": "2026-08-15", "theme": "Chủ đề thử"})
    assert r.status_code == 201, r.text
    i = r.json()
    assert i["label"] == "Số 18 (8-2026)" and i["year"] == 2026 and i["slug"] == "so-18-8-2026"
    # đổi ngày đăng -> nhãn tự cập nhật; sửa trường khác không đụng tới nhãn
    assert client.put(f"{A}/issues/{i['id']}", headers=auth, json={"published_at": "2026-09-02"}).json()["label"] == "Số 18 (9-2026)"
    assert client.put(f"{A}/issues/{i['id']}", headers=auth, json={"published": True}).json()["label"] == "Số 18 (9-2026)"
    assert client.get(f"{P}/issues").json()["issues"][0]["published_at"] == "2026-09-02"
    assert client.post(f"{A}/issues", headers=auth, json={"theme": "thiếu số"}).status_code == 422
    client.delete(f"{A}/issues/{i['id']}", headers=auth)


def test_spotlights_replace_hero(client, auth):
    i = client.post(f"{A}/issues", headers=auth, json={
        "number": 77, "published_at": "2027-01-10", "theme": "Số tiêu điểm", "published": True}).json()
    act = client.post(f"{A}/activities", headers=auth, json={"title": "Hội thảo tiêu điểm", "kind": "Hội thảo", "content": "<p>Nội dung hội thảo</p>", "published": True}).json()
    pg = client.post(f"{A}/pages", headers=auth, json={"title": "Giới thiệu tiêu điểm", "content": "<p>Về đặc san</p>", "published": True}).json()
    po = client.post(f"{A}/posts", headers=auth, json={"title": "Bài tiêu điểm", "body": "<p>Bài</p>", "published": True}).json()
    S = f"{A}/spotlights"
    # đúng một nội dung, và phải tồn tại
    assert client.post(S, headers=auth, json={}).status_code == 422
    assert client.post(S, headers=auth, json={"issue_id": i["id"], "page_id": pg["id"]}).status_code == 422
    assert client.post(S, headers=auth, json={"issue_id": 999999}).status_code == 422
    rows = [client.post(S, headers=auth, json=d).json() for d in (  # mục thêm sau luôn đứng trước
        {"post_id": po["id"]}, {"page_id": pg["id"], "title": "Tên riêng"}, {"activity_id": act["id"]}, {"issue_id": i["id"]})]
    hero = client.get(f"{P}/home").json()["hero"]
    assert [h["href"] for h in hero] == [f"/issues/{i['slug']}", f"/tin-hoat-dong/{act['id']}", f"/trang/{pg['slug']}", f"/bai-viet/{po['slug']}"]
    assert hero[0]["title"] == "Số tiêu điểm" and hero[2]["title"] == "Tên riêng"
    # hơn 10 mục: trang chủ chỉ lấy 10 mục thêm gần nhất
    extra = [client.post(S, headers=auth, json={"page_id": pg["id"], "title": f"Mục {n}"}).json() for n in range(8)]
    hero = client.get(f"{P}/home").json()["hero"]
    assert [h["title"] for h in hero[:8]] == [f"Mục {n}" for n in range(7, -1, -1)]
    assert len(hero) == 10 and hero[8]["href"] == f"/issues/{i['slug']}" and hero[9]["href"] == f"/tin-hoat-dong/{act['id']}"
    assert len(client.get(f"{P}/featured").json()) == 12
    for r_ in extra:
        client.delete(f"{S}/{r_['id']}", headers=auth)
    assert [x["kind"] for x in client.get(f"{P}/featured").json()] == ["issue", "activity", "page", "post"]
    # ẩn nội dung gốc hoặc ẩn dòng tiêu điểm thì không hiện
    client.put(f"{A}/activities/{act['id']}", headers=auth, json={"published": False})
    client.put(f"{S}/{rows[3]['id']}", headers=auth, json={"published": False})
    assert len(client.get(f"{P}/featured").json()) == 2
    # đổi sang nội dung khác: các tham chiếu cũ bị xóa
    r = client.put(f"{S}/{rows[0]['id']}", headers=auth, json={"issue_id": "", "post_id": po["id"]})
    assert r.status_code == 200 and r.json()["issue_id"] is None and r.json()["post_id"] == po["id"]
    for r_ in rows:
        client.delete(f"{S}/{r_['id']}", headers=auth)
    assert client.get(f"{P}/featured").json() == []
    assert len(client.get(f"{P}/home").json()["hero"]) == 6  # không còn mục tiêu điểm -> cách hiển thị cũ
    client.delete(f"{A}/issues/{i['id']}", headers=auth)
    client.delete(f"{A}/activities/{act['id']}", headers=auth)
    client.delete(f"{A}/pages/{pg['id']}", headers=auth)
    client.delete(f"{A}/posts/{po['id']}", headers=auth)


def test_activity_detail(client, auth):
    a = client.post(f"{A}/activities", headers=auth, json={"title": "Hội thảo thử", "content": "<p>Nội dung</p>", "published": True}).json()
    d = client.get(f"{P}/activities/{a['id']}").json()
    assert d["title"] == "Hội thảo thử" and d["content"] == "<p>Nội dung</p>"
    client.put(f"{A}/activities/{a['id']}", headers=auth, json={"published": False})
    assert client.get(f"{P}/activities/{a['id']}").status_code == 404  # ẩn thì không xem được
    assert client.get(f"{P}/activities/999999").status_code == 404
    client.delete(f"{A}/activities/{a['id']}", headers=auth)


def test_activity_types_and_content(client, auth):
    t = client.post(f"{A}/activity-types", headers=auth, json={"name": "Loại thử", "sort_order": 1})
    assert t.status_code == 201
    assert client.post(f"{A}/activity-types", headers=auth, json={"name": "Loại thử"}).status_code == 409
    a = client.post(f"{A}/activities", headers=auth, json={"title": "HĐ thử", "kind": "Loại thử", "content": "<p>Nội <b>dung</b></p>", "attachment_url": "/media/abc.docx"}).json()
    assert a["attachment_url"] == "/media/abc.docx" and a["content"] == "<p>Nội <b>dung</b></p>" and a["kind"] == "Loại thử"
    assert any(x["content"] == a["content"] for x in client.get(f"{P}/activities").json())
    client.delete(f"{A}/activities/{a['id']}", headers=auth)
    assert client.delete(f"{A}/activity-types/{t.json()['id']}", headers=auth).status_code == 204
