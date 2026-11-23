"""Tạo mục lục của số từ tệp PDF: xem trước (đọc bookmark / trang mục lục) rồi nhập các dòng đã xác nhận."""
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Field, Issue, TocEntry
from ..security import EDIT, require_roles
from ..services import audit
from ..services.util import slugify
from .media import media_path

router = APIRouter()


class TocItem(BaseModel):
    field: str = ""
    author: str = ""
    title: str
    page: int


class TocImportIn(BaseModel):
    items: list[TocItem]
    replace: bool = False  # true = xóa mục lục hiện có của số rồi tạo lại


def _issue_pdf_path(db: Session, issue_id: int) -> tuple[Issue, str]:
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(404, "Không tìm thấy số đặc san")
    url = (issue.pdf_url or "").strip()
    if not url:
        raise HTTPException(422, "Số này chưa có tệp PDF. Mở \"Sửa\" số đặc san, tải tệp PDF lên ở ô Tệp PDF rồi bấm Lưu.")
    path = media_path(url)
    if not path:
        raise HTTPException(422, f"Tệp PDF đang là liên kết ngoài ({url[:80]}). Hãy tải tệp PDF lên từ trang quản trị để tạo mục lục.")
    if not os.path.isfile(path):
        raise HTTPException(422, "Không tìm thấy tệp PDF trên máy chủ (có thể tệp nằm ở máy khác). Hãy tải lại tệp PDF rồi Lưu.")
    return issue, path


@router.post("/issues/{issue_id}/toc/preview", dependencies=[Depends(require_roles(*EDIT))])
def toc_preview(issue_id: int, db: Session = Depends(get_db)):
    from ..services.toc import extract_toc

    _, path = _issue_pdf_path(db, issue_id)
    try:
        return extract_toc(path)
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.post("/issues/{issue_id}/toc/import", dependencies=[Depends(require_roles(*EDIT))])
def toc_import(issue_id: int, body: TocImportIn, request: Request, db: Session = Depends(get_db)):
    """Tạo các dòng mục lục của số từ danh sách đã được biên tập viên xác nhận. Gọi lại không tạo trùng."""
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(404, "Không tìm thấy số đặc san")
    if not 1 <= len(body.items) <= 500:
        raise HTTPException(422, "Số mục không hợp lệ")

    if body.replace:
        for e in db.scalars(select(TocEntry).where(TocEntry.issue_id == issue.id)).all():
            db.delete(e)
        db.flush()
    fields = {slugify(f.name): f for f in db.scalars(select(Field))}
    existing = db.scalars(select(TocEntry).where(TocEntry.issue_id == issue.id)).all()
    seen = {(slugify(a.title), a.page_label) for a in existing}
    order = max((a.sort_order for a in existing), default=-1) + 1
    created = skipped = 0
    for it in body.items:
        title = " ".join(it.title.split())
        if not title or it.page < 0:
            skipped += 1
            continue
        label = f"tr. {it.page}" if it.page > 0 else ""
        if (slugify(title), label) in seen:
            skipped += 1
            continue
        field = None
        name = " ".join(it.field.split())
        if name:
            field = fields.get(slugify(name))
            if not field:
                field = Field(name=name[:200], sort_order=len(fields))
                db.add(field)
                db.flush()
                fields[slugify(name)] = field
        base, n = slugify(title), 1
        slug = base
        while db.scalars(select(TocEntry.id).where(TocEntry.slug == slug)).first():
            n += 1
            slug = f"{base}-{n}"
        db.add(TocEntry(slug=slug, issue_id=issue.id, field_id=field.id if field else None, title=title[:600],
                       author=it.author.strip()[:300], page_label=label, sort_order=order))
        seen.add((slugify(title), label))
        order += 1
        created += 1
    db.commit()
    audit.note(request, f"{issue.label}: thêm {created}, bỏ qua {skipped}" + (" (thay toàn bộ)" if body.replace else ""))
    return {"created": created, "skipped": skipped}
