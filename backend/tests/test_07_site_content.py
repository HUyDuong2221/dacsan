"""Trang nội dung tĩnh, xem trước số chưa công bố, lọc tìm kiếm, banner."""
from helpers import A, P, _login


def test_static_pages(client, auth):
    p = client.post(f"{A}/pages", headers=auth, json={"title": "Giới thiệu thử", "slug": "gioi-thieu-thu",
                                                     "content": "<p>Đặc san <b>KH&amp;PT</b></p>", "sort_order": 1})
    assert p.status_code == 201, p.text
    pid = p.json()["id"]
    d = client.get(f"{P}/pages/gioi-thieu-thu").json()
    assert d["title"] == "Giới thiệu thử" and "<b>KH&amp;PT</b>" in d["content"]
    assert any(x["slug"] == "gioi-thieu-thu" for x in client.get(f"{P}/pages").json())
    client.put(f"{A}/pages/{pid}", headers=auth, json={"published": False})
    assert client.get(f"{P}/pages/gioi-thieu-thu").status_code == 404
    assert all(x["slug"] != "gioi-thieu-thu" for x in client.get(f"{P}/pages").json())
    # cộng tác viên không sửa trang
    client.post(f"{A}/users", headers=auth, json={"email": "ctv5@t.vn", "password": "contrib-pass-5", "role": "contributor"})
    _, h = _login(client, "ctv5@t.vn", "contrib-pass-5")
    assert client.put(f"{A}/pages/{pid}", headers=h, json={"title": "x"}).status_code == 403
    assert client.get(f"{A}/pages", headers=h).status_code == 403
    uid = next(u["id"] for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == "ctv5@t.vn")
    client.delete(f"{A}/users/{uid}", headers=auth)
    assert client.delete(f"{A}/pages/{pid}", headers=auth).status_code == 204


def test_issue_preview_token(client, auth):
    from urllib.parse import parse_qs, urlparse

    iss = client.post(f"{A}/issues", headers=auth, json={"number": 950, "theme": "Số xem trước", "published_at": "2026-10-01"}).json()
    e = client.post(f"{A}/toc-entries", headers=auth, json={"issue_id": iss["id"], "title": "Bài trong số chưa công bố",
                                                           "author": "Tác Giả Xem Trước", "page_label": "tr. 3"}).json()
    other = client.post(f"{A}/issues", headers=auth, json={"number": 951, "theme": "Số khác", "published_at": "2026-10-02"}).json()
    assert client.get(f"{P}/issues/{iss['slug']}").status_code == 404
    assert client.get(f"{P}/articles/{e['slug']}").status_code == 404
    assert client.post(f"{A}/issues/{iss['id']}/preview-link").status_code == 401
    link = client.post(f"{A}/issues/{iss['id']}/preview-link", headers=auth).json()
    qs = parse_qs(urlparse(link["url"]).query)
    tok = qs["token"][0]
    assert qs["slug"] == [iss["slug"]] and link["published"] is False
    d = client.get(f"{P}/issues/{iss['slug']}", params={"preview": tok})
    assert d.status_code == 200 and d.json()["preview"] is True and d.json()["total"] == 1
    a = client.get(f"{P}/articles/{e['slug']}", params={"preview": tok})
    assert a.status_code == 200 and a.json()["preview"] is True
    # token của số này không mở được số khác; token sai bị bỏ qua
    assert client.get(f"{P}/issues/{other['slug']}", params={"preview": tok}).status_code == 404
    assert client.get(f"{P}/issues/{iss['slug']}", params={"preview": "rac"}).status_code == 404
    # không dùng token xem trước làm phiên đăng nhập
    assert client.get(f"{A}/auth/me", headers={"Authorization": f"Bearer {tok}"}).status_code == 401
    # xem trước không vào kết quả tìm kiếm công khai
    assert client.get(f"{P}/search", params={"q": "chưa công bố"}).json()["total"] == 0
    # số đã công bố: không cần token, preview=False
    client.put(f"{A}/issues/{iss['id']}", headers=auth, json={"published": True})
    assert client.get(f"{P}/issues/{iss['slug']}").json()["preview"] is False
    for i in (iss, other):
        client.delete(f"{A}/issues/{i['id']}", headers=auth)


def test_search_filters(client):
    assert client.get(f"{P}/search").status_code == 422
    assert client.get(f"{P}/search", params={"q": "a"}).status_code == 422
    opts = client.get(f"{P}/search/options").json()
    assert 2026 in opts["years"] and opts["fields"] and opts["issues"][0]["slug"] == "so-17-6-2026"
    by_author = client.get(f"{P}/search", params={"author": "pham ngoc linh"}).json()  # không dấu vẫn ra
    assert by_author["total"] >= 1 and all("Phạm Ngọc Linh" in r["author"] for r in by_author["results"])
    by_year = client.get(f"{P}/search", params={"year": 2026}).json()
    assert by_year["total"] >= 1 and all(r["issue"]["label"].endswith("2026)") for r in by_year["results"])
    assert client.get(f"{P}/search", params={"year": 1990}).json()["total"] == 0
    f = opts["fields"][0]
    by_field = client.get(f"{P}/search", params={"field": f, "year": 2026}).json()
    assert all(r["field"] == f for r in by_field["results"])


def test_banners(client, auth):
    B = f"{A}/banners"
    bad = [
        {"image_url": "/media/banner/a.jpg", "position": "giua-trang"},
        {"image_url": "/media/banner/a.jpg", "position": "top", "link": "javascript:alert(1)"},
        {"image_url": "/media/banner/a.jpg", "position": "top", "link": "//evil.example"},
        {"image_url": "", "position": "top"},
    ]
    for b in bad:
        assert client.post(B, headers=auth, json=b).status_code == 422, b
    made = [client.post(B, headers=auth, json=b).json() for b in [
        {"image_url": "/media/banner/2.jpg", "position": "top", "sort_order": 2, "alt": "Hai"},
        {"image_url": "/media/banner/1.jpg", "position": "top", "sort_order": 1, "link": "https://lhh.danang.gov.vn", "alt": "Một"},
        {"image_url": "/media/banner/3.jpg", "position": "before_submit", "link": " /gui-bai "},
        {"image_url": "/media/banner/an.jpg", "published": False},
    ]]
    assert made[2]["link"] == "/gui-bai" and made[3]["position"] == "top"  # mặc định vị trí đầu trang
    pub = client.get(f"{P}/banners").json()
    assert [(b["position"], b["alt"]) for b in pub] == [("before_submit", ""), ("top", "Một"), ("top", "Hai")]
    assert all(b["image_url"] != "/media/banner/an.jpg" for b in pub)
    # đổi vị trí; vị trí sai bị từ chối khi sửa
    assert client.put(f"{B}/{made[0]['id']}", headers=auth, json={"position": "before_topics"}).json()["position"] == "before_topics"
    assert client.put(f"{B}/{made[0]['id']}", headers=auth, json={"position": "xx"}).status_code == 422
    # chỉ quản trị viên
    client.post(f"{A}/users", headers=auth, json={"email": "bt6@t.vn", "password": "editor-pass-6", "role": "editor"})
    _, he = _login(client, "bt6@t.vn", "editor-pass-6")
    assert client.get(B, headers=he).status_code == 403
    assert client.post(B, headers=he, json={"image_url": "/media/banner/x.jpg"}).status_code == 403
    uid = next(u["id"] for u in client.get(f"{A}/users", headers=auth).json() if u["email"] == "bt6@t.vn")
    client.delete(f"{A}/users/{uid}", headers=auth)
    # ghi nhật ký
    assert client.get(f"{A}/audit-logs", headers=auth, params={"entity": "banners"}).json()["items"][0]["entity_label"] == "Banner"
    for b in made:
        assert client.delete(f"{B}/{b['id']}", headers=auth).status_code == 204
    assert client.get(f"{P}/banners").json() == []
