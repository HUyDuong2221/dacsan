"""Công cụ "Tạo bài từ PDF": tải một tệp PDF lên, chọn dải trang, lấy bản nháp bài (tiêu đề, tác giả, toàn văn, ảnh).

Tệp PDF tải lên chỉ để xử lý nên nằm trong PRIVATE_DIR (không công khai), gắn với người tải lên và tự xóa sau 24 giờ.
Các endpoint này không ghi vào cơ sở dữ liệu: bản nháp chỉ được lưu thành bài viết (bảng posts) khi biên tập viên xác nhận,
qua POST /posts. Chỉ biên tập viên trở lên dùng được vì bài lưu xong có thể được công bố ra website.
Ảnh cắt từ PDF được lưu vào MEDIA_DIR (công khai, như mọi ảnh bài viết) và đi qua máy quét mã độc.
"""
import os
import re
import secrets
import time

import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from ..config import settings
from ..models import User
from ..security import EDIT, require_roles
from ..services import audit, scanner
from ..services.pdf_article import extract_article

router = APIRouter(prefix="/pdf-articles")
TOKEN = re.compile(r"^[0-9a-f]{32}$")
KEEP_SECONDS = 24 * 3600


def _dir() -> str:
    return os.path.join(settings.private_dir, "pdf-articles")


def _path(user: User, token: str) -> str:
    p = os.path.join(_dir(), f"{user.id}-{token}.pdf") if TOKEN.match(token) else ""
    if not p or not os.path.isfile(p):
        raise HTTPException(404, "Không tìm thấy tệp PDF (có thể đã hết hạn sau 24 giờ), hãy tải lên lại")
    return p


def _purge() -> None:
    """Xóa tệp PDF tạm quá 24 giờ."""
    try:
        for name in os.listdir(_dir()):
            p = os.path.join(_dir(), name)
            if os.path.isfile(p) and time.time() - os.path.getmtime(p) > KEEP_SECONDS:
                os.remove(p)
    except OSError:
        pass


@router.post("/upload")
async def upload(file: UploadFile, request: Request, user: User = Depends(require_roles(*EDIT))):
    name = file.filename or "tep.pdf"
    if os.path.splitext(name)[1].lower() != ".pdf":
        raise HTTPException(415, "Chỉ nhận tệp PDF")
    os.makedirs(_dir(), exist_ok=True)
    _purge()
    token = secrets.token_hex(16)
    path = os.path.join(_dir(), f"{user.id}-{token}.pdf")
    limit = settings.max_upload_mb * 1024 * 1024
    size = 0
    head = b""
    with open(path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            if not head:
                head = chunk[:5]
            size += len(chunk)
            if size > limit:
                f.close()
                os.remove(path)
                raise HTTPException(413, f"Tệp vượt quá {settings.max_upload_mb}MB")
            f.write(chunk)
    if head != b"%PDF-":
        os.remove(path)
        raise HTTPException(415, "Tệp không phải PDF hợp lệ")
    scanner.check_file(path, request, name)  # có mã độc: xóa tệp, báo lỗi
    try:
        with fitz.open(path) as doc:
            if doc.needs_pass:
                raise ValueError("Tệp PDF có mật khẩu, hãy bỏ mật khẩu rồi tải lên lại")
            pages = doc.page_count
        if not pages:
            raise ValueError("Tệp PDF không có trang nào")
    except ValueError as e:
        os.remove(path)
        raise HTTPException(422, str(e))
    except Exception:
        os.remove(path)
        raise HTTPException(422, "Không đọc được tệp PDF")
    audit.note(request, f"{name[:150]} ({pages} trang)")
    return {"token": token, "filename": name, "page_count": pages}


@router.get("/{token}/page/{n}")
def page_image(token: str, n: int, user: User = Depends(require_roles(*EDIT))):
    """Ảnh thu nhỏ của một trang, để người dùng chọn đúng dải trang."""
    path = _path(user, token)
    with fitz.open(path) as doc:
        if not 1 <= n <= doc.page_count:
            raise HTTPException(404, "Không có trang này")
        data = doc[n - 1].get_pixmap(dpi=70, alpha=False).tobytes("jpeg", jpg_quality=70)
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=300"})


class ExtractIn(BaseModel):
    page_from: int  # trang PDF, đánh số từ 1
    page_to: int
    images: bool = True


@router.post("/{token}/extract")
def extract(token: str, body: ExtractIn, request: Request, user: User = Depends(require_roles(*EDIT))):
    path = _path(user, token)
    try:
        res = extract_article(path, body.page_from, body.page_to, images_dir=settings.media_dir if body.images else None)
    except ValueError as e:
        raise HTTPException(422, str(e))
    for im in res["images"]:  # ảnh cắt từ PDF là tệp mới ghi vào /media nên phải qua máy quét
        name = im["url"].rsplit("/", 1)[-1]
        scanner.check_file(os.path.join(settings.media_dir, name), request, name)
    audit.note(request, f"tr. {body.page_from}-{body.page_to}: {len(res['body'])} ký tự, {len(res['images'])} ảnh")
    return res


@router.delete("/{token}", status_code=204)
def remove(token: str, request: Request, user: User = Depends(require_roles(*EDIT))):
    path = _path(user, token)
    os.remove(path)
    audit.note(request, "Xóa tệp PDF tạm")
