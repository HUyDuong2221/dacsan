import re
import unicodedata


def slugify(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text[:100] or "muc"


def headings(body: str | None) -> list[str]:
    if not body:
        return []
    return [ln[3:].strip() for ln in body.splitlines() if ln.startswith("## ")]


# ---- nội dung HTML do trình soạn thảo CKEditor tạo ra (bài viết độc lập) ----
_TAG = re.compile(r"<[^>]+>")
_HEAD = re.compile(r"<(h[2-4])(\s[^>]*)?>(.*?)</\1>", re.I | re.S)
_IMG_SRC = re.compile(r"<img\b[^>]*?\bsrc=[\"']([^\"']+)[\"']", re.I)
_PARA = re.compile(r"<p\b[^>]*>(.*?)</p>", re.I | re.S)


def html_text(fragment: str) -> str:
    """Chữ thuần của một đoạn HTML (bỏ thẻ, giải mã ký tự đặc biệt, gọn khoảng trắng)."""
    import html

    return " ".join(html.unescape(_TAG.sub(" ", fragment or "")).split())


def html_excerpt(body: str | None, limit: int = 240) -> str:
    """Đoạn văn đầu tiên có chữ, cắt gọn ở ranh giới từ."""
    for m in _PARA.finditer(body or ""):
        t = html_text(m.group(1))
        if t:
            return t if len(t) <= limit else t[:limit].rsplit(" ", 1)[0] + "…"
    return ""


def html_first_image(body: str | None) -> str | None:
    """Ảnh đầu tiên của bài (đường dẫn trong site hoặc https)."""
    for m in _IMG_SRC.finditer(body or ""):
        src = m.group(1)
        if src.startswith("/") and not src.startswith("//") or src.startswith("https://"):
            return src
    return None


def html_add_heading_ids(body: str | None) -> tuple[str, list[dict]]:
    """Gắn id h-0, h-1… cho các đề mục h2–h4 để làm mục lục bài; trả về (html mới, [{id, text, level}])."""
    toc: list[dict] = []

    def put(m: "re.Match[str]") -> str:
        text = html_text(m.group(3))
        if not text:
            return m.group(0)
        hid = f"h-{len(toc)}"
        toc.append({"id": hid, "text": text, "level": int(m.group(1)[1])})
        attrs = re.sub(r"\sid=([\"']).*?\1", "", m.group(2) or "")
        return f'<{m.group(1)}{attrs} id="{hid}">{m.group(3)}</{m.group(1)}>'

    return _HEAD.sub(put, body or ""), toc
