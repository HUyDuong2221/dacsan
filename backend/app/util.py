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
