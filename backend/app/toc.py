"""Trích mục lục từ file PDF của số đặc san.

Hai nguồn, theo thứ tự ưu tiên:
1. Bookmark/outline của PDF (nếu có): cấp 1 = chuyên mục, cấp 2 = bài.
2. Trang "Mục lục" dạng chữ: dòng kết thúc bằng số trang; dòng IN HOA không có số = tên chuyên mục;
   "TÁC GIẢ - Tiêu đề" (tác giả in hoa) được tách thành tác giả và tiêu đề.

Kết quả chỉ là ĐỀ XUẤT để biên tập viên xem lại, không tự xuất bản.
"""
import re

import fitz  # PyMuPDF

SKIP_HEADS = {"MỤC LỤC", "MUC LUC", "CONTENTS", "NỘI DUNG", "NOI DUNG", "TABLE OF CONTENTS"}
TRAIL = re.compile(r"^(.*?)[\s.·…_]*\s(\d{1,3})$")
AUTHOR_SPLIT = re.compile(r"\s+[-–—]\s+")
MAX_SCAN_PAGES = 12


def _is_upper(s: str) -> bool:
    letters = [c for c in s if c.isalpha()]
    return len(letters) >= 3 and sum(c.isupper() for c in letters) / len(letters) >= 0.85


def _field_name(s: str) -> str:
    s = " ".join(s.split()).strip(" .:-–—")
    return s.capitalize() if _is_upper(s) else s


def split_author(text: str) -> tuple[str, str]:
    text = " ".join(text.split())
    parts = AUTHOR_SPLIT.split(text, maxsplit=1)
    if len(parts) == 2:
        left = parts[0].strip(" -–—")
        if left and len(left) <= 70 and (_is_upper(left) or left.upper().replace(".", "") in {"PV", "P V"}):
            return (left.title() if _is_upper(left) else left), parts[1].strip()
    return "", text


def page_lines(page: "fitz.Page") -> list[str]:
    """Dựng lại các dòng chữ theo toạ độ (số trang canh phải vẫn nằm cùng dòng với tiêu đề)."""
    words = page.get_text("words")
    words.sort(key=lambda w: ((w[1] + w[3]) / 2, w[0]))
    lines: list[list[tuple]] = []
    cy = None
    for w in words:
        c = (w[1] + w[3]) / 2
        if cy is None or abs(c - cy) > 3:
            lines.append([])
            cy = c
        lines[-1].append(w)
    return [" ".join(w[4] for w in sorted(ln, key=lambda w: w[0])) for ln in lines]


def _from_outline(doc: "fitz.Document") -> list[dict]:
    toc = doc.get_toc(simple=True)
    deep_mode = sum(1 for e in toc if e[0] >= 2) >= 5  # cấp 1 = chuyên mục, cấp 2 trở xuống = bài
    items, field = [], ""
    for lvl, title, page in toc:
        if deep_mode and lvl == 1:
            field = _field_name(title)
            continue
        if (lvl < 2) if deep_mode else (lvl != 1):
            continue
        if not 1 <= page <= len(doc):
            continue
        author, t = split_author(title)
        items.append({"field": field if deep_mode else "", "author": author, "title": t, "page": page})
    return items if len(items) >= 5 else []


def _from_text(doc: "fitz.Document") -> list[dict]:
    scanned = []
    for p in range(min(MAX_SCAN_PAGES, len(doc))):
        lines = page_lines(doc[p])
        n = sum(1 for ln in lines if len(ln) > 12 and TRAIL.match(ln))
        scanned.append((p, lines, n))
    if not scanned:
        return []
    best = max(scanned, key=lambda s: s[2])
    if best[2] < 5:
        return []
    pages = [best]
    nxt = next((s for s in scanned if s[0] == best[0] + 1), None)
    if nxt and nxt[2] >= 3:
        pages.append(nxt)

    items, buf, field = [], [], ""
    for _, lines, _n in pages:
        for ln in lines:
            ln = ln.strip()
            if not ln:
                continue
            m = TRAIL.match(ln)
            if re.fullmatch(r"\d{1,3}", ln):
                head, num = "", int(ln)
            elif m:
                head, num = m.group(1).strip(), int(m.group(2))
            else:
                if not buf and _is_upper(ln) and ln.upper() not in SKIP_HEADS:
                    field = _field_name(ln)
                elif ln.upper() not in SKIP_HEADS or buf:
                    buf.append(ln)
                continue
            text = " ".join(buf + ([head] if head else [])).strip()
            buf = []
            if len(text) < 4 or not 1 <= num <= len(doc):
                continue
            author, title = split_author(text)
            items.append({"field": field, "author": author, "title": title, "page": num})
    return items if len(items) >= 5 else []


def extract_toc(path: str) -> dict:
    """Trả {"source": "outline"|"text", "items": [...]}. Ném ValueError nếu không nhận diện được."""
    try:
        doc = fitz.open(path)
    except Exception as e:  # tệp hỏng / không phải PDF
        raise ValueError("Không đọc được file PDF") from e
    with doc:
        items = _from_outline(doc)
        if items:
            return {"source": "outline", "page_count": len(doc), "items": items}
        items = _from_text(doc)
        if items:
            return {"source": "text", "page_count": len(doc), "items": items}
    raise ValueError(
        "Không nhận diện được mục lục trong PDF (không có bookmark và không tìm thấy trang mục lục dạng chữ). "
        "Hãy nhập bài thủ công."
    )
