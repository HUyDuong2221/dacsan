"""Gửi bài cho Đặc san: biểu mẫu công khai + tra cứu tiến độ + xử lý của ban biên tập.

Bản thảo lưu ở private_dir (không nằm trong /media nên không truy cập công khai),
chỉ quản trị viên/biên tập viên tải được qua API có đăng nhập.
"""
import os
import re
import secrets

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import SUBMISSION_STATUSES, Submission
from ..security import client_ip, require_roles, submit_limiter, track_limiter

public_router = APIRouter()
admin_router = APIRouter(prefix="/submissions", dependencies=[Depends(require_roles("admin", "editor"))])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ALLOWED_EXT = {".doc", ".docx", ".pdf", ".odt"}


def _dt(v):
    return v.isoformat() if v else None


# ---------- công khai ----------
@public_router.post("/submissions", status_code=201)
async def submit(
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    title: str = Form(...),
    abstract: str = Form(...),
    consent: str = Form(""),
    organization: str = Form(""),
    phone: str = Form(""),
    field_name: str = Form(""),
    website: str = Form(""),  # ô bẫy cho bot: người thật không thấy và không điền
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    ip = client_ip(request)
    submit_limiter.check(ip)
    if website.strip():
        return {"code": secrets.token_hex(4).upper()}  # giả vờ thành công, không lưu gì
    name, email, title, abstract = name.strip(), email.strip().lower(), title.strip(), abstract.strip()
    if not 2 <= len(name) <= 200:
        raise HTTPException(422, "Vui lòng nhập họ tên")
    if not EMAIL_RE.match(email) or len(email) > 255:
        raise HTTPException(422, "Email không hợp lệ")
    if not 5 <= len(title) <= 600:
        raise HTTPException(422, "Tiêu đề bài viết cần từ 5 đến 600 ký tự")
    if not 30 <= len(abstract) <= 5000:
        raise HTTPException(422, "Tóm tắt cần từ 30 đến 5000 ký tự")
    if consent.strip().lower() not in {"true", "on", "1", "yes"}:
        raise HTTPException(422, "Bạn cần xác nhận cam kết bản quyền và chưa đăng ở nơi khác")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(415, "Bản thảo phải là tệp Word (.doc, .docx), PDF hoặc .odt")

    os.makedirs(settings.private_dir, exist_ok=True)
    stored = f"{secrets.token_hex(12)}{ext}"
    path = os.path.join(settings.private_dir, stored)
    limit, size = settings.max_submission_mb * 1024 * 1024, 0
    with open(path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > limit:
                f.close()
                os.remove(path)
                raise HTTPException(413, f"Bản thảo vượt quá {settings.max_submission_mb}MB")
            f.write(chunk)
    if size == 0:
        os.remove(path)
        raise HTTPException(422, "Tệp bản thảo trống")

    code = secrets.token_hex(4).upper()
    while db.scalars(select(Submission.id).where(Submission.code == code)).first():
        code = secrets.token_hex(4).upper()
    db.add(Submission(
        code=code, name=name[:200], email=email, organization=organization.strip()[:300], phone=phone.strip()[:40],
        field_name=field_name.strip()[:200], title=title, abstract=abstract,
        file_path=stored, file_name=(file.filename or stored)[:300],
    ))
    db.commit()
    submit_limiter.record(ip)
    return {"code": code}


class TrackIn(BaseModel):
    email: str
    code: str


@public_router.post("/submissions/track")
def track(body: TrackIn, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    track_limiter.check(ip)
    s = db.scalars(select(Submission).where(
        Submission.code == body.code.strip().upper(), Submission.email == body.email.strip().lower())).first()
    if not s:
        track_limiter.record(ip)
        raise HTTPException(404, "Không tìm thấy bài gửi với email và mã này")
    return {
        "code": s.code, "title": s.title, "status": s.status, "status_label": SUBMISSION_STATUSES.get(s.status, s.status),
        "note": s.note_public, "created_at": _dt(s.created_at), "updated_at": _dt(s.updated_at),
    }


# ---------- ban biên tập ----------
def sub_dict(s: Submission) -> dict:
    return {
        "id": s.id, "code": s.code, "name": s.name, "email": s.email, "organization": s.organization, "phone": s.phone,
        "field_name": s.field_name, "title": s.title, "abstract": s.abstract, "file_name": s.file_name,
        "status": s.status, "status_label": SUBMISSION_STATUSES.get(s.status, s.status),
        "note_public": s.note_public, "note_internal": s.note_internal,
        "created_at": _dt(s.created_at), "updated_at": _dt(s.updated_at),
    }


@admin_router.get("")
def list_submissions(status: str | None = None, db: Session = Depends(get_db)):
    q = select(Submission).order_by(Submission.id.desc())
    if status:
        q = q.where(Submission.status == status)
    return [sub_dict(s) for s in db.scalars(q)]


class SubUpdate(BaseModel):
    status: str | None = None
    note_public: str | None = None
    note_internal: str | None = None


@admin_router.put("/{sid}")
def update_submission(sid: int, body: SubUpdate, db: Session = Depends(get_db)):
    s = db.get(Submission, sid)
    if not s:
        raise HTTPException(404, "Không tìm thấy bài gửi")
    if body.status is not None:
        if body.status not in SUBMISSION_STATUSES:
            raise HTTPException(422, "Trạng thái không hợp lệ")
        s.status = body.status
    if body.note_public is not None:
        s.note_public = body.note_public.strip() or None
    if body.note_internal is not None:
        s.note_internal = body.note_internal.strip() or None
    db.commit()
    return sub_dict(s)


@admin_router.get("/{sid}/file")
def download_file(sid: int, db: Session = Depends(get_db)):
    s = db.get(Submission, sid)
    path = os.path.join(settings.private_dir, os.path.basename(s.file_path)) if s else ""
    if not s or not os.path.isfile(path):
        raise HTTPException(404, "Không tìm thấy bản thảo")
    return FileResponse(path, filename=s.file_name)


@admin_router.delete("/{sid}", status_code=204, dependencies=[Depends(require_roles("admin"))])
def delete_submission(sid: int, db: Session = Depends(get_db)):
    s = db.get(Submission, sid)
    if not s:
        raise HTTPException(404, "Không tìm thấy bài gửi")
    try:
        os.remove(os.path.join(settings.private_dir, os.path.basename(s.file_path)))
    except OSError:
        pass
    db.delete(s)
    db.commit()
