"""Công cụ "Tạo bài từ PDF": tiêu đề, tác giả, đề mục, chữ cái lớn, nối đoạn qua trang, ảnh + chú thích, tệp tạm, quyền."""
import os

import pytest

from helpers import A, P, _login

BODY1 = ("han dip ky niem 25 nam thanh lap Lien hiep cac Hoi Khoa hoc va Ky thuat thanh pho Da Nang, Thanh uy to chuc toa dam "
         "voi chu de rat quan trong cho su phat trien ben vung cua thanh pho va dat nuoc trong giai doan moi cua cach mang.")
PART_A = "Van de nay duoc cac dai bieu quan tam va thao luan soi noi, dong thoi de xuat nhieu giai phap cu the de"
PART_B = "thuc hien trong nhung nam toi. Ket thuc phan mot cua bai viet nay."


def _png(path):
    import fitz

    pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 300, 200), False)
    pix.clear_with(180)
    pix.save(path)


def _make_article_pdf(path, png):
    import fitz

    doc = fitz.open()
    for k in range(5):
        pg = doc.new_page(width=552, height=793)
        pg.insert_text((140, 40), f"DAC SAN KHOA HOC & PHAT TRIEN THANH PHO DA NANG {k + 1}", fontsize=10)  # dòng chạy đầu trang
        if k in (1, 2, 3):
            if k == 1:
                pg.insert_text((60, 120), "TIEU DE BAI VIET LON", fontsize=27, fontname="hebo")
                pg.insert_text((60, 150), "NGUYEN VAN AN", fontsize=13, fontname="hebo")
                pg.insert_text((60, 200), "H", fontsize=60)  # chữ cái lớn đầu bài, còn lại "han dip…" viết thường
                pg.insert_textbox(fitz.Rect(110, 195, 270, 480), BODY1[1:] if BODY1.startswith("h") else BODY1, fontsize=13)
                pg.insert_textbox(fitz.Rect(290, 195, 500, 480), "De muc phu", fontsize=14, fontname="hebo")
                pg.insert_textbox(fitz.Rect(290, 220, 500, 700), "Noi dung dau tien cua cot thu hai trong bai viet. " * 3, fontsize=13)
                pg.insert_textbox(fitz.Rect(60, 500, 270, 700), PART_A, fontsize=13)  # câu bị cắt ở cuối trang
            if k == 2:
                pg.insert_textbox(fitz.Rect(60, 100, 270, 200), PART_B, fontsize=13)  # phần còn lại ở đầu trang sau
                pg.insert_image(fitz.Rect(60, 230, 360, 430), filename=png)
                pg.insert_textbox(fitz.Rect(60, 436, 360, 470), "Chu thich cua anh minh hoa.", fontsize=10, fontname="heit")
            pg.insert_text((250, 780), str(k + 1), fontsize=9)  # số trang cuối trang
    doc.save(path)
    doc.close()


def test_extract_article_service(tmp_path):
    from app.services.pdf_article import extract_article

    png = f"{tmp_path}/a.png"
    pdf = f"{tmp_path}/bai.pdf"
    _png(png)
    _make_article_pdf(pdf, png)
    out = tmp_path / "img"
    r = extract_article(pdf, 2, 3, images_dir=str(out))
    assert r["title"] == "TIEU DE BAI VIET LON" and r["author"] == "Nguyen Van An"
    body = r["body"]
    assert "DAC SAN KHOA HOC" not in body  # dòng chạy đầu trang bị bỏ
    assert body.startswith("Han dip ky niem")  # chữ cái lớn được ghép lại vào đầu từ
    assert "## De muc phu" in body
    assert f"{PART_A} {PART_B}" in body.replace("\n", " ")  # câu bị cắt giữa hai trang được nối lại
    assert len(r["images"]) == 1 and r["images"][0]["caption"] == "Chu thich cua anh minh hoa."
    assert f"![Chu thich cua anh minh hoa.]({r['images'][0]['url']})" in body
    name = r["images"][0]["url"].rsplit("/", 1)[-1]
    assert (out / name).stat().st_size > 500

    # không lấy ảnh: không có ảnh, không có chú thích ảnh trong bài
    r2 = extract_article(pdf, 2, 3, images_dir=None)
    assert r2["images"] == [] and "![" not in r2["body"] and "Chu thich cua anh" not in r2["body"]


def test_extract_article_rejects_bad_input(tmp_path):
    import fitz
    from app.services.pdf_article import extract_article

    pdf = f"{tmp_path}/blank.pdf"
    d = fitz.open(); d.new_page(); d.new_page(); d.save(pdf); d.close()
    for a, b in [(0, 1), (2, 1), (1, 3)]:
        with pytest.raises(ValueError):
            extract_article(pdf, a, b)
    with pytest.raises(ValueError):  # PDF không có lớp chữ (dạng scan)
        extract_article(pdf, 1, 2)
    with pytest.raises(ValueError):
        extract_article(pdf, 1, 60)


def _upload(client, headers, pdf_path, name="so-moi.pdf"):
    with open(pdf_path, "rb") as f:
        return client.post(f"{A}/pdf-articles/upload", headers=headers, files={"file": (name, f.read(), "application/pdf")})


def test_pdf_article_tool_flow(client, auth, tmp_path):
    png = f"{tmp_path}/b.png"
    pdf = f"{tmp_path}/so-moi.pdf"
    _png(png)
    _make_article_pdf(pdf, png)

    # tải lên: cần đăng nhập, chỉ nhận PDF thật
    assert client.post(f"{A}/pdf-articles/upload", files={"file": ("a.pdf", b"%PDF-1.4", "application/pdf")}).status_code == 401
    assert client.post(f"{A}/pdf-articles/upload", headers=auth, files={"file": ("a.txt", b"%PDF-1.4", "text/plain")}).status_code == 415
    assert client.post(f"{A}/pdf-articles/upload", headers=auth, files={"file": ("a.pdf", b"khong phai pdf", "application/pdf")}).status_code == 415
    assert client.post(f"{A}/pdf-articles/upload", headers=auth, files={"file": ("a.pdf", b"%PDF-1.4 hong", "application/pdf")}).status_code == 422

    up = _upload(client, auth, pdf)
    assert up.status_code == 200, up.text
    info = up.json()
    tok = info["token"]
    assert info["page_count"] == 5 and info["filename"] == "so-moi.pdf" and len(tok) == 32
    # tệp nằm ở thư mục private, không công khai
    assert not os.path.exists(os.path.join(os.environ["MEDIA_DIR"], f"{tok}.pdf"))
    assert any(tok in n for n in os.listdir(os.path.join(os.environ["PRIVATE_DIR"], "pdf-articles")))

    # ảnh thu nhỏ của trang
    pg = client.get(f"{A}/pdf-articles/{tok}/page/2", headers=auth)
    assert pg.status_code == 200 and pg.headers["content-type"] == "image/jpeg" and pg.content[:2] == bytes([0xFF, 0xD8])
    assert client.get(f"{A}/pdf-articles/{tok}/page/99", headers=auth).status_code == 404
    assert client.get(f"{A}/pdf-articles/{tok}/page/2").status_code == 401

    # trích bài
    url = f"{A}/pdf-articles/{tok}/extract"
    body = {"page_from": 2, "page_to": 3, "images": True}
    assert client.post(url, json=body).status_code == 401
    assert client.post(url, headers=auth, json={"page_from": 3, "page_to": 2}).status_code == 422
    assert client.post(f"{A}/pdf-articles/{'0' * 32}/extract", headers=auth, json=body).status_code == 404
    assert client.post(f"{A}/pdf-articles/khong-hop-le/extract", headers=auth, json=body).status_code == 404
    r = client.post(url, headers=auth, json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["title"] == "TIEU DE BAI VIET LON" and d["author"] == "Nguyen Van An" and len(d["images"]) == 1
    assert os.path.isfile(os.path.join(os.environ["MEDIA_DIR"], d["images"][0]["url"].rsplit("/", 1)[-1]))
    no_img = client.post(url, headers=auth, json={**body, "images": False}).json()
    assert no_img["images"] == [] and "![" not in no_img["body"] and "<img" not in no_img["html"]
    # html cho trình soạn thảo: đề mục h2, đoạn p, ảnh có chú thích (figure.image + figcaption), đã escape
    assert "<h2>De muc phu</h2>" in d["html"] and "<p>Han dip ky niem" in d["html"]
    assert f'<img src="{d["images"][0]["url"]}" alt="Chu thich cua anh minh hoa."><figcaption>Chu thich cua anh minh hoa.</figcaption>' in d["html"]

    # lưu thành bài viết riêng (nháp): chưa hiện ra công khai
    assert client.post(f"{A}/posts", json={"title": "x"}).status_code == 401
    assert client.post(f"{A}/posts", headers=auth, json={"title": "", "body": "x"}).status_code == 422
    post = client.post(f"{A}/posts", headers=auth, json={"title": "Bài từ PDF thử nghiệm", "author": d["author"], "body": d["html"]})
    assert post.status_code == 201, post.text
    pj = post.json()
    assert pj["published"] is False and pj["published_at"] and pj["slug"] == "bai-tu-pdf-thu-nghiem" and pj["body"] == d["html"]
    assert all(x["slug"] != pj["slug"] for x in client.get(f"{P}/posts").json())
    assert client.get(f"{P}/posts/{pj['slug']}").status_code == 404

    # công bố: hiện ở danh sách (có tóm tắt, ảnh đại diện) và trang chi tiết (có mục lục đề mục)
    assert client.put(f"{A}/posts/{pj['id']}", headers=auth, json={"published": True}).status_code == 200
    card = next(x for x in client.get(f"{P}/posts").json() if x["slug"] == pj["slug"])
    assert card["excerpt"].startswith("Han dip ky niem") and card["cover"] == d["images"][0]["url"] and card["author"] == "Nguyen Van An"
    det = client.get(f"{P}/posts/{pj['slug']}").json()
    assert det["title"] == "Bài từ PDF thử nghiệm" and det["toc"] == [{"id": "h-0", "text": "De muc phu", "level": 2}]
    assert '<h2 id="h-0">De muc phu</h2>' in det["body"] and '<figure class="image"><img src="' in det["body"]
    # gỡ công bố thì biến mất
    client.put(f"{A}/posts/{pj['id']}", headers=auth, json={"published": False})
    assert client.get(f"{P}/posts/{pj['slug']}").status_code == 404

    # nhật ký ghi trích bài và bài viết
    logs = client.get(f"{A}/audit-logs", headers=auth, params={"limit": 40}).json()
    items = logs["items"] if isinstance(logs, dict) else logs
    assert any(x["action"] == "extract" and x["action_label"] == "Lấy bài từ PDF" for x in items)
    assert any(x["entity"] == "posts" and x["entity_label"] == "Bài viết" for x in items)

    # xóa tệp tạm
    assert client.delete(f"{A}/pdf-articles/{tok}", headers=auth).status_code == 204
    assert client.post(url, headers=auth, json=body).status_code == 404


def test_pdf_article_tool_roles_and_isolation(client, auth, tmp_path):
    png = f"{tmp_path}/c.png"
    pdf = f"{tmp_path}/c.pdf"
    _png(png)
    _make_article_pdf(pdf, png)
    for email, role in (("ctv13@t.vn", "contributor"), ("bt13@t.vn", "editor"), ("bt14@t.vn", "editor")):
        client.post(f"{A}/users", headers=auth, json={"email": email, "password": "pass-word-13", "role": role})
    _, hc = _login(client, "ctv13@t.vn", "pass-word-13")
    _, h1 = _login(client, "bt13@t.vn", "pass-word-13")
    _, h2 = _login(client, "bt14@t.vn", "pass-word-13")

    # cộng tác viên không dùng được công cụ và không tạo được bài viết (bài lưu xong có thể công bố ra website)
    assert _upload(client, hc, pdf).status_code == 403
    assert client.post(f"{A}/posts", headers=hc, json={"title": "x", "body": "y"}).status_code == 403
    assert client.get(f"{A}/posts", headers=hc).status_code == 403

    tok = _upload(client, h1, pdf).json()["token"]  # biên tập viên dùng được
    body = {"page_from": 2, "page_to": 3, "images": False}
    assert client.post(f"{A}/pdf-articles/{tok}/extract", headers=h1, json=body).status_code == 200
    # tệp gắn theo người tải lên: người khác (kể cả quản trị viên) không dùng được
    assert client.post(f"{A}/pdf-articles/{tok}/extract", headers=h2, json=body).status_code == 404
    assert client.post(f"{A}/pdf-articles/{tok}/extract", headers=auth, json=body).status_code == 404
    assert client.get(f"{A}/pdf-articles/{tok}/page/1", headers=h2).status_code == 404
    assert client.delete(f"{A}/pdf-articles/{tok}", headers=h2).status_code == 404
    assert client.post(f"{A}/posts", headers=h1, json={"title": "Bài của biên tập viên", "body": "Nội dung"}).status_code == 201
    assert client.delete(f"{A}/pdf-articles/{tok}", headers=h1).status_code == 204


def test_html_helpers_and_to_html():
    from app.services.pdf_article import to_html
    from app.services.util import html_add_heading_ids, html_excerpt, html_first_image, html_text

    nl = chr(10)
    assert to_html(nl.join(["## A & B", "", "Doan <b>mot</b>", "", "![Chu thich](/media/x.jpg)"])) == nl.join([
        "<h2>A &amp; B</h2>", "<p>Doan &lt;b&gt;mot&lt;/b&gt;</p>",
        '<figure class="image"><img src="/media/x.jpg" alt="Chu thich"><figcaption>Chu thich</figcaption></figure>'])
    html = '<h2>Mo dau</h2><p>&nbsp;</p><p>Doan <strong>dau</strong> tien &amp; cuoi.</p><figure class="image"><img src="/media/a.jpg"></figure><h3 id="x">Muc nho</h3>'
    assert html_text("<p>Xin&nbsp;<b>chao</b>  ban</p>") == "Xin chao ban"
    assert html_excerpt(html) == "Doan dau tien & cuoi."
    assert html_excerpt("<p>" + "tu " * 200 + "</p>").endswith("…") and len(html_excerpt("<p>" + "tu " * 200 + "</p>")) <= 241
    assert html_first_image(html) == "/media/a.jpg"
    assert html_first_image('<img src="javascript:alert(1)"><img src="//evil/x.jpg">') is None
    out, toc = html_add_heading_ids(html)
    assert toc == [{"id": "h-0", "text": "Mo dau", "level": 2}, {"id": "h-1", "text": "Muc nho", "level": 3}]
    assert '<h2 id="h-0">Mo dau</h2>' in out and '<h3 id="h-1">Muc nho</h3>' in out and 'id="x"' not in out
    assert html_add_heading_ids(None) == ("", [])


def test_paragraph_split_without_geometry_cues(tmp_path):
    """PDF không thụt đầu dòng và dòng cuối đoạn không ngắn: vẫn xuống đoạn khi hết câu rồi chữ hoa, trừ chữ viết tắt."""
    import fitz
    from app.services.pdf_article import _abbr_end, _ends_sentence, extract_article

    lines = [
        "Cau mot cua doan thu nhat. Cau hai cua doan thu nhat.",
        "Doan thu hai bat dau o day va keo dai den het dong va",
        "tiep tuc sang dong ke tiep roi ket thuc o day.",
        "Doan thu ba noi ve ong GS.",
        "Hoang Chau Ky va cac cong su cua ong.",
        "Doan thu tu ket thuc bai viet.",
    ]
    pdf = f"{tmp_path}/doan.pdf"
    doc = fitz.open()
    for k in range(3):
        pg = doc.new_page(width=552, height=793)
        if k == 1:
            y = 120
            for t in lines:
                pg.insert_text((60, y), t, fontsize=13)
                y += 16
    doc.save(pdf)
    doc.close()
    paras = [p for p in extract_article(pdf, 2, 2)["body"].split("\n\n") if p]
    assert paras == [
        "Cau mot cua doan thu nhat. Cau hai cua doan thu nhat.",
        "Doan thu hai bat dau o day va keo dai den het dong va tiep tuc sang dong ke tiep roi ket thuc o day.",
        "Doan thu ba noi ve ong GS. Hoang Chau Ky va cac cong su cua ong.",  # "GS." không phải hết câu
        "Doan thu tu ket thuc bai viet.",
    ]
    assert _abbr_end("ong GS.") and _abbr_end("TS. Nguyen N.V.Q.") and _abbr_end("ThS.") and not _abbr_end("o Hue.")
    assert _ends_sentence("het cau.") and _ends_sentence('noi rang "het cau."') and not _ends_sentence("PGS.") and not _ends_sentence("chua het")
