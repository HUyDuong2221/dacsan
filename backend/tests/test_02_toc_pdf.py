"""Tạo mục lục từ PDF, chuyên mục theo số, gộp chuyên mục."""
import os

import pytest

from helpers import A, P


def _make_pdf(path, outline=False):
    import fitz

    doc = fitz.open()
    doc.new_page()  # bìa
    pg = doc.new_page()
    pg.insert_text((50, 60), "MUC LUC", fontsize=16)
    y = 100
    rows = [("Loi thua", None), ("NHAN VAT", None), ("NGUYEN VAN A - Mot nguoi di truoc", 7), ("TRAN THI B - Bai viet co tieu de rat dai can phai", None),
            ("xuong dong de kiem tra", 12), ("CAU CHUYEN VAN HOA", None), ("LE C - Hon bien", 15), ("P.V - Thong tin khoa hoc", 18),
            ("Loi thua khong tac gia", 20)]
    for text, num in rows:
        pg.insert_text((50, y), text, fontsize=11)
        if num:
            pg.insert_text((520, y), str(num), fontsize=11)
        y += 22
    for _ in range(22):
        doc.new_page()
    for k in range(1, 5):  # tiêu đề chạy đầu trang: "4 DAC SAN KHOA HOC…" lặp ở nhiều trang
        doc[k].insert_text((50, 30), f"{k + 3} DAC SAN KHOA HOC & PHAT TRIEN THANH PHO DA NANG", fontsize=9)
    if outline:
        doc.set_toc([[1, "NHAN VAT", 7], [2, "NGUYEN VAN A - Mot nguoi", 7], [2, "Bai hai", 9], [2, "Bai ba", 10],
                     [1, "VAN HOA", 12], [2, "Bai bon", 12], [2, "Bai nam", 14]])
    doc.save(path)
    doc.close()


def test_toc_text_parse(tmp_path):
    from app.services.toc import extract_toc

    p = f"{tmp_path}/toc_text.pdf"
    _make_pdf(p)
    r = extract_toc(p)
    assert r["source"] == "text"
    it = r["items"]
    assert [i["page"] for i in it] == [0, 7, 12, 15, 18, 20]
    # dòng không có số trang đứng trước tên phần ("Lời thưa") là một mục riêng, không bị dính vào tên phần/tác giả
    assert it[0] == {"field": "", "author": "", "title": "Loi thua", "page": 0}
    assert it[1] == {"field": "NHAN VAT", "author": "Nguyen Van A", "title": "Mot nguoi di truoc", "page": 7}
    assert it[2]["title"].endswith("xuong dong de kiem tra")  # tiêu đề xuống dòng được nối lại
    assert it[3]["field"] == "CAU CHUYEN VAN HOA" and it[4]["author"] == "P.V"
    assert it[5]["author"] == "" and it[5]["title"] == "Loi thua khong tac gia"


def test_toc_outline_parse(tmp_path):
    from app.services.toc import extract_toc

    p = f"{tmp_path}/toc_outline.pdf"
    _make_pdf(p, outline=True)
    r = extract_toc(p)
    assert r["source"] == "outline" and len(r["items"]) == 5
    assert r["items"][0]["field"] == "NHAN VAT" and r["items"][3]["field"] == "VAN HOA"


def test_toc_rejects_pdf_without_toc(tmp_path):
    import fitz
    from app.services.toc import extract_toc

    p = f"{tmp_path}/blank.pdf"
    d = fitz.open(); d.new_page(); d.save(p); d.close()
    with pytest.raises(ValueError):
        extract_toc(p)


def test_toc_endpoints_preview_and_idempotent_import(client, auth):
    os.makedirs(os.environ["MEDIA_DIR"], exist_ok=True)
    _make_pdf(f"{os.environ['MEDIA_DIR']}/so55.pdf")
    i = client.post(f"{A}/issues", headers=auth, json={"number": 55, "published_at": "2026-05-01", "theme": "t", "pdf_url": "/media/so55.pdf"}).json()
    nopdf = client.post(f"{A}/issues", headers=auth, json={"number": 56, "published_at": "2026-05-01", "theme": "t"}).json()
    assert client.post(f"{A}/issues/{nopdf['id']}/toc/preview", headers=auth).status_code == 422
    assert client.post(f"{A}/issues/{i['id']}/toc/preview").status_code == 401
    pre = client.post(f"{A}/issues/{i['id']}/toc/preview", headers=auth)
    assert pre.status_code == 200 and len(pre.json()["items"]) == 6
    items = pre.json()["items"]
    r = client.post(f"{A}/issues/{i['id']}/toc/import", headers=auth, json={"items": items}).json()
    assert r == {"created": 6, "skipped": 0}
    assert client.post(f"{A}/issues/{i['id']}/toc/import", headers=auth, json={"items": items}).json() == {"created": 0, "skipped": 6}
    arts = client.get(f"{A}/toc-entries", headers=auth, params={"issue_id": i["id"]}).json()
    assert len(arts) == 6
    assert [a["sort_order"] for a in arts] == [0, 1, 2, 3, 4, 5]
    assert arts[0]["page_label"] == ""
    assert client.get(f"{P}/issues/{i['slug']}").status_code == 404 or client.get(f"{P}/issues/{i['slug']}").json()["total"] == 0  # số chưa công bố thì mục lục không lộ
    fields = {f["name"]: f["id"] for f in client.get(f"{A}/fields", headers=auth).json()}
    assert "NHAN VAT" not in fields  # khớp chuyên mục có sẵn "Nhân vật" (không phân biệt dấu), không tạo trùng
    assert arts[1]["field_id"] == fields["Nhân vật"]
    client.delete(f"{A}/issues/{i['id']}", headers=auth)
    client.delete(f"{A}/issues/{nopdf['id']}", headers=auth)


def test_toc_text_ignores_running_page_header(tmp_path):
    from app.services.toc import extract_toc

    p = f"{tmp_path}/toc_header.pdf"
    _make_pdf(p)
    r = extract_toc(p)
    assert all("DAC SAN" not in (i["field"] + i["title"]) for i in r["items"])


def test_sections_are_per_issue_and_replace_import(client, auth):
    # tab chuyên mục ở trang chủ chỉ gồm các phần của số mới nhất, không lẫn chuyên mục của số khác
    iss = client.post(f"{A}/issues", headers=auth, json={"number": 200, "published_at": "2027-01-01", "theme": "t", "published": True}).json()
    for n, (fld, title) in enumerate([("PHAN MOT", "a"), ("PHAN HAI", "b"), ("PHAN MOT", "c")]):
        fid = client.post(f"{A}/fields", headers=auth, json={"name": fld}).json().get("id") if n < 2 else None
        if fid is None:
            fid = next(f["id"] for f in client.get(f"{A}/fields", headers=auth).json() if f["name"] == fld)
        client.post(f"{A}/toc-entries", headers=auth, json={"issue_id": iss["id"], "title": title, "field_id": fid, "sort_order": n})
    assert client.get(f"{P}/home").json()["fields"] == ["PHAN MOT", "PHAN HAI"]
    assert client.get(f"{P}/issues").json()["fields"] == ["PHAN MOT", "PHAN HAI"]
    # nhập lại ở chế độ thay thế: xóa mục lục cũ của số rồi tạo lại
    items = [{"field": "MOI", "author": "", "title": f"dong {k}", "page": k + 1} for k in range(3)]
    assert client.post(f"{A}/issues/{iss['id']}/toc/import", headers=auth, json={"items": items, "replace": True}).json() == {"created": 3, "skipped": 0}
    assert len(client.get(f"{A}/toc-entries", headers=auth, params={"issue_id": iss["id"]}).json()) == 3
    assert client.get(f"{P}/home").json()["fields"] == ["MOI"]
    client.delete(f"{A}/issues/{iss['id']}", headers=auth)


def test_merge_field(client, auth):
    a = client.post(f"{A}/fields", headers=auth, json={"name": "GOP A"}).json()
    b = client.post(f"{A}/fields", headers=auth, json={"name": "GOP B"}).json()
    iss = client.post(f"{A}/issues", headers=auth, json={"number": 300, "published_at": "2027-02-01", "theme": "t"}).json()
    client.post(f"{A}/toc-entries", headers=auth, json={"issue_id": iss["id"], "title": "dong gop", "field_id": a["id"]})
    assert client.post(f"{A}/fields/{a['id']}/merge", headers=auth, json={"target_id": a["id"]}).status_code == 422
    assert client.post(f"{A}/fields/{a['id']}/merge", headers=auth, json={"target_id": b["id"]}).json() == {"moved": 1}
    assert client.get(f"{A}/toc-entries", headers=auth, params={"issue_id": iss["id"]}).json()[0]["field_id"] == b["id"]
    assert a["id"] not in [f["id"] for f in client.get(f"{A}/fields", headers=auth).json()]
    client.put(f"{A}/fields/{b['id']}", headers=auth, json={"name": "GOP B da doi ten"})  # đổi tên chuyên mục
    assert any(f["name"] == "GOP B da doi ten" for f in client.get(f"{A}/fields", headers=auth).json())
    client.delete(f"{A}/issues/{iss['id']}", headers=auth)
