"""Tệp tải lên: kho chung (/media) và kho ảnh giao diện (logo, banner); đường dẫn và số trang PDF đã tải lên."""
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import BANNER_POSITIONS, Banner, Document, Issue, Setting
from ..security import EDIT, STAFF, require_roles
from ..services import audit, scanner

router = APIRouter()


def media_path(url: str | None) -> str | None:
    """Đường dẫn tệp trong MEDIA_DIR từ URL "/media/..." (chấp nhận cả URL đầy đủ http(s)://<host>/media/...)."""
    from urllib.parse import unquote, urlparse

    p = unquote(urlparse((url or "").strip()).path)
    if not p.startswith("/media/"):
        return None
    parts = [s for s in p[len("/media/"):].split("/") if s]
    if not parts or any(s in (".", "..") for s in parts):
        return None
    return os.path.join(settings.media_dir, *parts)


def pdf_page_count(url: str | None) -> int | None:
    """Số trang của tệp PDF đã tải lên (/media/...); None nếu không đọc được."""
    path = media_path(url)
    if not path or not os.path.isfile(path):
        return None
    try:
        import fitz  # PyMuPDF

        with fitz.open(path) as doc:
            return doc.page_count or None
    except Exception:
        return None


MEDIA_KINDS = ("logo", "banner")
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx", ".xls", ".xlsx"}


@router.post("/upload", dependencies=[Depends(require_roles(*STAFF))])
async def upload(file: UploadFile, request: Request, kind: str = ""):
    """kind: "" = kho chung (bìa, tư liệu...), "logo", "banner" = kho riêng của từng loại ảnh giao diện."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED:
        raise HTTPException(415, f"Định dạng không được phép: {ext or '?'}")
    if kind and kind not in MEDIA_KINDS:
        raise HTTPException(400, "Loại ảnh không hợp lệ")
    if kind and ext not in IMAGE_EXT:
        raise HTTPException(415, "Chỉ nhận ảnh jpg, png, webp")
    folder = os.path.join(settings.media_dir, kind) if kind else settings.media_dir
    os.makedirs(folder, exist_ok=True)
    name = f"{secrets.token_hex(8)}{ext}"
    limit = settings.max_upload_mb * 1024 * 1024
    size = 0
    with open(os.path.join(folder, name), "wb") as f:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > limit:
                f.close()
                os.remove(f.name)
                raise HTTPException(413, f"Tệp vượt quá {settings.max_upload_mb}MB")
            f.write(chunk)
    scanner.check_file(os.path.join(folder, name), request, file.filename or name)  # có mã độc: xóa tệp, báo lỗi
    url = f"/media/{kind}/{name}" if kind else f"/media/{name}"
    audit.note(request, f"{(file.filename or name)[:200]} → {url}")
    return {"url": url}


def _media_usage(db: Session) -> dict[str, list[str]]:
    """url -> nơi đang dùng (số đặc san, tư liệu, cấu hình site)."""
    use: dict[str, list[str]] = {}
    for i in db.scalars(select(Issue)):
        for u in (i.cover_url, i.pdf_url):
            if u:
                use.setdefault(u, []).append(i.label)
    for d in db.scalars(select(Document)):
        if d.file_url:
            use.setdefault(d.file_url, []).append(d.title)
    for b in db.scalars(select(Banner)):
        use.setdefault(b.image_url, []).append("Banner: " + (b.alt or BANNER_POSITIONS.get(b.position, b.position)))
    for st in db.scalars(select(Setting)):
        if st.value and st.value.startswith("/media/"):
            use.setdefault(st.value, []).append("Cấu hình: " + st.key)
    return use


@router.get("/media", dependencies=[Depends(require_roles(*STAFF))])
def list_media(kind: str = "logo", db: Session = Depends(get_db)):
    """Kho ảnh riêng của từng loại (logo | banner), mới nhất trước."""
    if kind not in MEDIA_KINDS:
        raise HTTPException(400, "Loại ảnh không hợp lệ")
    d = os.path.join(settings.media_dir, kind)
    if not os.path.isdir(d):
        return []
    use = _media_usage(db)
    items = []
    for name in os.listdir(d):
        if os.path.splitext(name)[1].lower() in IMAGE_EXT:
            st = os.stat(os.path.join(d, name))
            url = f"/media/{kind}/{name}"
            items.append({"url": url, "name": name, "kind": kind, "size": st.st_size, "mtime": st.st_mtime, "used_by": use.get(url, [])})
    items.sort(key=lambda x: x["mtime"], reverse=True)
    return items[:200]


@router.delete("/media/{kind}/{name}", status_code=204, dependencies=[Depends(require_roles(*EDIT))])
def delete_media(kind: str, name: str, request: Request, db: Session = Depends(get_db)):
    if kind not in MEDIA_KINDS:
        raise HTTPException(400, "Loại ảnh không hợp lệ")
    name = os.path.basename(name)
    if os.path.splitext(name)[1].lower() not in IMAGE_EXT:
        raise HTTPException(400, "Chỉ xóa được tệp ảnh")
    path = os.path.join(settings.media_dir, kind, name)
    if not os.path.isfile(path):
        raise HTTPException(404, "Không tìm thấy ảnh")
    used = _media_usage(db).get(f"/media/{kind}/{name}")
    if used:
        raise HTTPException(409, "Ảnh đang được dùng ở: " + ", ".join(used))
    os.remove(path)
    audit.note(request, f"/media/{kind}/{name}")
