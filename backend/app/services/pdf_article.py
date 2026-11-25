"""Lấy nội dung một bài từ dải trang của file PDF số đặc san và đổi sang "toàn văn" của dự án.

Đầu ra "body" là markdown-lite mà ArticleReader hiểu (đề mục `## `, đoạn cách nhau một dòng trống, ảnh `![chú thích](/media/...)`);
"html" là cùng nội dung ở dạng HTML để nạp vào trình soạn thảo CKEditor (bài viết độc lập lưu HTML).
Chỉ dùng PyMuPDF (đã có cho services/toc.py), không thêm thư viện. Các quy tắc dựa trên bố cục của đặc san:
chữ thân một cỡ, đề mục phụ in đậm lớn hơn chữ thân, tiêu đề bài rất lớn, chữ cái lớn (drop cap) đầu bài,
chú thích ảnh in nghiêng cỡ nhỏ, dòng chạy đầu trang lặp ở nhiều trang, bài xếp hai cột.

Kết quả chỉ là ĐỀ XUẤT để biên tập viên đọc lại và sửa, không tự xuất bản.
"""
import os
import re
import secrets
from collections import Counter

import fitz  # PyMuPDF

MAX_PAGES = 40
MAX_IMAGES = 12
TERMINAL = re.compile(r"[.!?…:;”\"»)\]]$")
PUA = re.compile(r"[-\x00-\x08\x0b-\x1f\x7f-\x9f]")  # glyph gạch đầu dòng (Wingdings/Symbol) bị đọc thành vùng riêng hoặc mã điều khiển
SYMBOL_FONTS = ("wingdings", "symbol", "zapfdingbats", "webdings")
TEXT_FLAGS = fitz.TEXT_MEDIABOX_CLIP  # không lấy ảnh trong get_text("dict"); ảnh lấy riêng bằng get_image_info
HEAD_BAND, FOOT_BAND = 0.095, 0.935  # dải đầu/cuối trang (tỉ lệ chiều cao) để tìm dòng chạy và số trang


def to_html(body: str) -> str:
    """Toàn văn markdown-lite -> HTML cho trình soạn thảo (đề mục h2, đoạn p, ảnh có chú thích dạng figure.image của CKEditor)."""
    import html

    out = []
    for blk in re.split(r"\n{2,}", (body or "").strip()):
        blk = blk.strip()
        if not blk:
            continue
        if blk.startswith("## "):
            out.append(f"<h2>{html.escape(blk[3:].strip())}</h2>")
            continue
        m = re.match(r"^!\[(.*)\]\((.+)\)$", blk)
        if m:
            cap = html.escape(m.group(1))
            cap_html = f"<figcaption>{cap}</figcaption>" if cap else ""
            out.append(f'<figure class="image"><img src="{html.escape(m.group(2), quote=True)}" alt="{cap}">{cap_html}</figure>')
        else:
            out.append(f"<p>{html.escape(blk)}</p>")
    return "\n".join(out)


def _norm(text: str) -> str:
    return re.sub(r"[\d\W_]+", "", text.lower())


def _squash(text: str) -> str:
    return " ".join(PUA.sub("", text).split())


def _in_band(bbox, height: float) -> bool:
    return bbox[3] <= HEAD_BAND * height or bbox[1] >= FOOT_BAND * height


def _running_heads(doc: "fitz.Document") -> set[str]:
    """Chữ lặp lại ở đầu/cuối nhiều trang (VD "ĐẶC SAN KHOA HỌC & PHÁT TRIỂN… 12"), bỏ số để so khớp."""
    n = doc.page_count
    sample = sorted(set(range(0, n, max(1, n // 12))))[:14]
    seen: Counter[str] = Counter()
    for i in sample:
        page = doc[i]
        found = set()
        for b in page.get_text("blocks", flags=TEXT_FLAGS):
            if b[6] == 0 and _in_band(b[:4], page.rect.height):
                key = _norm(b[4])
                if key:
                    found.add(key)
        seen.update(found)
    need = max(2, int(len(sample) * 0.25))
    return {k for k, c in seen.items() if c >= need}


def _span_is_symbol(span: dict) -> bool:
    return span["font"].lower().startswith(SYMBOL_FONTS) or (span["text"] and not PUA.sub("", span["text"]).strip() and bool(PUA.search(span["text"])))


def _body_size(all_lines: list[dict]) -> float:
    c: Counter[float] = Counter()
    for ln in all_lines:
        c[round(ln["size"] * 2) / 2] += len(ln["t"])
    return c.most_common(1)[0][0] if c else 0.0


def _block_lines(block: dict) -> list[dict]:
    out = []
    for ln in block["lines"]:
        spans = [s for s in ln["spans"] if not _span_is_symbol(s)]
        had_symbol = len(spans) != len(ln["spans"])
        real0 = [s for s in spans if s["text"].strip()]
        if len(real0) >= 2:  # chữ cái lớn đầu bài nằm chung dòng với dòng chữ đầu tiên: tách thành "dòng" riêng
            s0, rest = real0[0], real0[1:]
            t0 = _squash(s0["text"])
            if len(t0) == 1 and t0.isalpha() and s0["size"] >= 2.2 * max(s["size"] for s in rest):
                out.append({"t": t0, "size": s0["size"], "x0": s0["bbox"][0], "x1": s0["bbox"][2], "y0": s0["bbox"][1],
                            "y1": s0["bbox"][3], "bold": False, "ital": False, "sym": False})
                spans = [s for s in spans if s is not s0]
        text = _squash("".join(s["text"] for s in spans))
        if not text:
            continue
        real = [s for s in spans if s["text"].strip()]
        out.append({
            "t": text, "size": max(s["size"] for s in real), "x0": min(s["bbox"][0] for s in real), "x1": max(s["bbox"][2] for s in real),
            "y0": min(s["bbox"][1] for s in real), "y1": max(s["bbox"][3] for s in real),
            "bold": all(s["flags"] & 16 for s in real), "ital": all(s["flags"] & 2 for s in real), "sym": had_symbol,
        })
    return out


SENT_END = re.compile(r"[.!?…]+[”\"»)\]]*$")
ABBR = re.compile(r"^(?:[A-ZĐ]\.)+[A-ZĐ]?$|^Th[sS]?$")  # N.V.Q., Th.S


def _abbr_end(text: str) -> bool:
    """Dòng kết thúc bằng chữ viết tắt có dấu chấm ("GS.", "TS.", "TP.", "N.V.Q."), không phải hết câu."""
    words = text.rstrip("”\"»)] ").split()
    last = words[-1] if words else ""
    if not last.endswith("."):
        return False
    stem = last.rstrip(".")
    return (stem.isalpha() and stem.isupper() and len(stem) <= 5) or bool(ABBR.match(last)) or bool(ABBR.match(stem))


def _ends_sentence(text: str) -> bool:
    """Dòng kết thúc một câu."""
    return bool(SENT_END.search(text)) and not _abbr_end(text)


def _starts_upper(text: str) -> bool:
    ch = text.lstrip("“\"‘'(-–— ")[:1]
    return ch.isalpha() and ch.isupper()


def _block_items(lines: list[dict], body: float) -> list[dict]:
    """Các dòng của một khối chữ -> đề mục / đoạn văn / chữ cái lớn đầu bài / chú thích ứng viên."""
    if not lines:
        return []
    total = sum(len(ln["t"]) for ln in lines)
    first = lines[0]
    if len(lines) == 1 and len(first["t"]) == 1 and first["t"].isalpha() and first["size"] >= body * 2.2:
        return [{"k": "drop", "t": first["t"]}]
    if total <= 260 and all(ln["ital"] or ln["size"] <= body - 1.5 for ln in lines):
        return [{"k": "cap", "t": " ".join(ln["t"] for ln in lines)}]
    x0 = min(ln["x0"] for ln in lines)
    x1max = max(ln["x1"] for ln in lines)
    items: list[dict] = []
    cur: dict | None = None
    for ln in lines:
        if len(ln["t"]) == 1 and ln["t"].isalpha() and ln["size"] >= body * 2.2:
            items.append({"k": "drop", "t": ln["t"]})  # chữ cái lớn đầu bài (có thể nằm chung khối với tiêu đề)
            cur = None
            continue
        head = (ln["bold"] and ln["size"] >= body + 0.5) or ln["size"] >= body * 1.25
        if head:
            if cur and cur["k"] == "h" and abs(cur["size"] - ln["size"]) < 1:
                cur["t"] += " " + ln["t"]
            else:
                cur = {"k": "h", "t": ln["t"], "size": ln["size"], "sym": ln["sym"], "y1": ln["y1"]}
                items.append(cur)
            cur["y1"] = ln["y1"]
            continue
        if cur and cur["k"] == "p":
            gap = ln["y0"] - cur["y1"]
            ends = _ends_sentence(cur["t"])
            indent = ln["x0"] - x0 >= 8  # đầu đoạn thụt vào
            short = cur["x1"] < x1max - 0.12 * (x1max - x0)  # dòng cuối đoạn ngắn hơn bề rộng cột
            # nhiều bài không có dấu hiệu hình học nào (không thụt, dòng cuối vẫn dàn đủ), nên câu kết thúc ở cuối dòng
            # và dòng sau bắt đầu bằng chữ hoa cũng được coi là xuống đoạn
            new = gap > 0.6 * ln["size"] or (bool(TERMINAL.search(cur["t"])) and not _abbr_end(cur["t"]) and (indent or short)) or (ends and _starts_upper(ln["t"]))
        else:
            new = True
        if new:
            cur = {"k": "p", "t": ln["t"], "size": ln["size"], "sym": ln["sym"], "y1": ln["y1"], "x1": ln["x1"]}
            items.append(cur)
        else:
            cur["t"] += " " + ln["t"]
            cur["y1"] = ln["y1"]
            cur["x1"] = ln["x1"]
    for it in items:
        if it["k"] == "h" and len(it["t"]) > 160 and it["size"] < body * 1.6:
            it["k"] = "p"  # đề mục quá dài thực ra là đoạn in đậm
    if len(items) == 1 and items[0]["k"] == "h" and len(items[0]["t"]) == 1 and items[0]["t"].isalpha():
        return [{"k": "drop", "t": items[0]["t"]}]  # chữ cái lớn đầu bài, cỡ chưa đủ lớn để nhận ngay
    return items


def _order(elems: list[dict], width: float) -> list[dict]:
    """Thứ tự đọc của một trang: khối rộng (tiêu đề, ảnh lớn) ngăn các nhóm; vùng hai cột đọc hết cột trái rồi cột phải."""
    for e in elems:
        w = e["bbox"][2] - e["bbox"][0]
        e["wide"] = w >= 0.6 * width
        e["col"] = 0 if (e["bbox"][0] + e["bbox"][2]) / 2 < width / 2 else 1
        e["h"] = e["bbox"][3] - e["bbox"][1]
    out: list[dict] = []
    group: list[dict] = []

    def flush():
        tall0 = [e for e in group if e["col"] == 0 and e["h"] >= 120]
        tall1 = [e for e in group if e["col"] == 1 and e["h"] >= 120]
        if tall0 and tall1:
            ry0 = min(e["bbox"][1] for e in tall0 + tall1) - 5
            ry1 = max(e["bbox"][3] for e in tall0 + tall1) + 5
            before = [e for e in group if e["bbox"][3] <= ry0 + 12]
            after = [e for e in group if e["bbox"][1] >= ry1 - 12 and e not in before]
            mid = [e for e in group if e not in before and e not in after]
            key = lambda e: (e["bbox"][1], e["bbox"][0])  # noqa: E731
            out.extend(sorted(before, key=key))
            out.extend(sorted(mid, key=lambda e: (e["col"], e["bbox"][1])))
            out.extend(sorted(after, key=key))
        else:
            out.extend(sorted(group, key=lambda e: (e["bbox"][1], e["bbox"][0])))
        group.clear()

    for e in sorted(elems, key=lambda e: (e["bbox"][1], e["bbox"][0])):
        if e["wide"]:
            flush()
            out.append(e)
        else:
            group.append(e)
    flush()
    return out


def _page_images(page: "fitz.Page", seen: set[int]) -> list[dict]:
    """Ảnh đáng kể của trang (bỏ ảnh nền cả trang, ảnh nhỏ/trang trí, ảnh trong dải đầu-cuối trang, ảnh đã gặp ở trang trước)."""
    W, H = page.rect.width, page.rect.height
    out = []
    for info in page.get_image_info(xrefs=True):
        r = fitz.Rect(info["bbox"]) & page.rect
        if r.is_empty or r.width < 40 or r.height < 40 or (info.get("width") or 0) < 120:
            continue
        area = r.width * r.height / (W * H)
        if area < 0.03 or area > 0.85 or _in_band((r.x0, r.y0, r.x1, r.y1), H):
            continue
        xref = info.get("xref") or 0
        if xref and xref in seen:
            continue
        if xref:
            seen.add(xref)
        out.append({"k": "img", "bbox": (r.x0, r.y0, r.x1, r.y1), "rect": r})
    return out


def _attach_captions(elems: list[dict]) -> list[dict]:
    """Chú thích gần ảnh (dưới hoặc trên, cách ≤ 45pt, chồng ngang) được gắn vào ảnh."""
    caps = [e for e in elems if e["k"] == "cap"]
    for im in [e for e in elems if e["k"] == "img"]:
        best, dist = None, 46.0
        for c in caps:
            if c.get("used"):
                continue
            cb, ib = c["bbox"], im["bbox"]
            if min(cb[2], ib[2]) - max(cb[0], ib[0]) <= 0:
                continue
            d = min(abs(cb[1] - ib[3]), abs(ib[1] - cb[3]))
            if d < dist:
                best, dist = c, d
        if best:
            best["used"] = True
            im["caption"] = best["t"]
    return [e for e in elems if not e.get("used")]


def _render(page: "fitz.Page", rect: "fitz.Rect") -> bytes:
    dpi = min(130, int(1600 * 72 / max(rect.width, 1)))
    pix = page.get_pixmap(clip=rect, dpi=max(dpi, 60), alpha=False)
    return pix.tobytes("jpeg", jpg_quality=85)


def extract_article(path: str, first: int, last: int, images_dir: str | None = None, url_prefix: str = "/media") -> dict:
    """Trang first..last (đánh số từ 1) -> {"title", "author", "body", "images": [{"url", "page", "caption"}], "pages", "warnings"}.
    images_dir = None: bỏ qua ảnh (và chú thích ảnh). Ảnh được lưu thành .jpg trong images_dir, url_prefix + tên tệp là đường dẫn."""
    doc = fitz.open(path)
    try:
        n = doc.page_count
        if first < 1 or last < first or last > n:
            raise ValueError(f"Dải trang không hợp lệ (PDF có {n} trang)")
        if last - first + 1 > MAX_PAGES:
            raise ValueError(f"Chọn tối đa {MAX_PAGES} trang cho một bài")
        heads = _running_heads(doc)
        per_page: list[tuple[int, "fitz.Page", list[tuple[tuple, list[dict]]]]] = []
        all_lines: list[dict] = []
        for pno in range(first - 1, last):
            page = doc[pno]
            H = page.rect.height
            kept = []
            for b in page.get_text("dict", flags=TEXT_FLAGS)["blocks"]:
                if b["type"] != 0:
                    continue
                lines = []
                for ln in _block_lines(b):
                    in_band = ln["y1"] <= HEAD_BAND * H or ln["y0"] >= FOOT_BAND * H
                    key = _norm(ln["t"])
                    # dòng chạy, số trang, nhãn đầu trang ("11 TRÍ THỨC VIỆT NAM"): mọi dòng ngắn nằm trong dải đầu/cuối trang
                    if in_band and (not key or key in heads or len(ln["t"]) <= 70):
                        continue
                    lines.append(ln)
                if lines:
                    bbox = (min(l["x0"] for l in lines), min(l["y0"] for l in lines), max(l["x1"] for l in lines), max(l["y1"] for l in lines))
                    kept.append((bbox, lines))
                    all_lines += lines
            per_page.append((pno + 1, page, kept))
        body_size = _body_size(all_lines)
        if body_size <= 0:
            raise ValueError("Không đọc được chữ trong các trang này (có thể là PDF dạng ảnh scan). Hãy nhập toàn văn thủ công.")

        flat: list[dict] = []
        out_images: list[dict] = []
        seen_xref: set[int] = set()
        warnings: list[str] = []
        for pno, page, blocks in per_page:
            elems: list[dict] = []
            for bbox, lines in blocks:
                for it in _block_items(lines, body_size):
                    elems.append({**it, "bbox": bbox})
            imgs = _page_images(page, seen_xref)
            elems += imgs
            elems = _attach_captions(elems)
            for e in _order(elems, page.rect.width):
                e["page"] = pno
                if e["k"] == "img":
                    if images_dir is None:
                        continue
                    if len(out_images) >= MAX_IMAGES:
                        if "Chỉ lấy tối đa" not in " ".join(warnings):
                            warnings.append(f"Chỉ lấy tối đa {MAX_IMAGES} ảnh đầu tiên")
                        continue
                    name = f"{secrets.token_hex(8)}.jpg"
                    os.makedirs(images_dir, exist_ok=True)
                    with open(os.path.join(images_dir, name), "wb") as f:
                        f.write(_render(page, e["rect"]))
                    e["url"] = f"{url_prefix}/{name}"
                    out_images.append({"url": e["url"], "page": pno, "caption": e.get("caption", "")})
                flat.append(e)

        # chữ cái lớn đầu bài + đoạn bắt đầu bằng chữ thường -> ghép lại thành chữ đầu từ
        items: list[dict] = []
        pending = ""
        for e in flat:
            if e["k"] == "drop":
                pending = e["t"]
            elif e["k"] == "p" and pending:
                if e["t"][:1].islower():
                    e["t"] = pending + e["t"]
                pending = ""
                items.append(e)
            else:
                if e["k"] == "cap":
                    e["k"] = "p"  # chú thích không gắn với ảnh nào: giữ lại như một đoạn
                items.append(e)

        # tiêu đề (đề mục rất lớn đầu dải trang) và tác giả (dòng ngắn ngay sau tiêu đề)
        title = author = ""
        first_page = first
        for k, e in enumerate(items):
            if e["page"] != first_page:
                break
            if e["k"] == "h" and e["size"] >= body_size * 1.8:
                title = e["t"]
                del items[k]
                # nhãn chuyên mục in hoa ngắn nằm phía trên tiêu đề (VD "ĐÀ NẴNG TRÊN ĐƯỜNG PHÁT TRIỂN")
                kick = [j for j in range(k) if items[j]["k"] == "p" and items[j]["t"].isupper() and len(items[j]["t"]) <= 80]
                for j in reversed(kick):
                    del items[j]
                k -= len(kick)
                if k < len(items) and items[k]["k"] == "p" and len(items[k]["t"]) <= 60 and (items[k]["t"].isupper() or items[k].get("sym")):
                    author = items[k]["t"].strip(" *").title()
                    del items[k]
                break

        # nối đoạn bị cắt ở cuối cột/trang (chưa kết câu, đoạn sau bắt đầu bằng chữ thường)
        merged: list[dict] = []
        for e in items:
            if e["k"] == "p":
                j = len(merged) - 1
                while j >= 0 and merged[j]["k"] == "img":
                    j -= 1
                if j >= 0 and merged[j]["k"] == "p" and not TERMINAL.search(merged[j]["t"]) and e["t"][:1].islower():
                    merged[j]["t"] += " " + e["t"]
                    continue
            merged.append(e)

        parts = []
        for e in merged:
            if e["k"] == "h":
                parts.append("## " + e["t"])
            elif e["k"] == "img":
                parts.append(f"![{e.get('caption', '').replace('[', '(').replace(']', ')')}]({e['url']})")
            else:
                parts.append(e["t"])
        body = "\n\n".join(parts)
        if not title:
            warnings.append("Không nhận ra tiêu đề bài ở trang đầu, hãy nhập tiêu đề")
        return {"title": title, "author": author, "body": body, "html": to_html(body), "images": out_images, "pages": last - first + 1, "warnings": warnings}
    finally:
        doc.close()
