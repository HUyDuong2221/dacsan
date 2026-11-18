"""Documents (tư liệu) and notices (thông báo của tòa soạn): public + editorial API."""
from __future__ import annotations
from datetime import date
from pathlib import Path
from uuid import uuid4
import bleach
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.api import SAFE_ATTRS, SAFE_TAGS
from app.auth import require_admin, require_editor
from app.core import get_db, settings
from app.importer import slugify
from app.models import AuditLog, Document, Notice, User, utc_now

public = APIRouter(tags=['Public'])
admin = APIRouter(prefix='/admin', tags=['Editorial CMS'])

DOC_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx'}
DOC_MAX_BYTES = 20 * 1024 * 1024
OLE = b'\xd0\xcf\x11\xe0'
DOC_MAGIC = {'.pdf': b'%PDF-', '.doc': OLE, '.xls': OLE, '.docx': b'PK', '.xlsx': b'PK'}


def clean_html(html: str) -> str:
    return bleach.clean(html, tags=SAFE_TAGS, attributes=SAFE_ATTRS, protocols=['http', 'https'], strip=True)


def check_url(url: str) -> str:
    url = url.strip()
    if url and not url.lower().startswith(('http://', 'https://')):
        raise HTTPException(422, 'Liên kết ngoài phải bắt đầu bằng http:// hoặc https://')
    return url


def document_json(d: Document, for_admin=False):
    out = dict(id=d.id, title=d.title, doc_type=d.doc_type, description=d.description,
               file_key=d.file_key, file_name=d.file_name, external_url=d.external_url,
               updated_at=d.updated_at.isoformat() if d.updated_at else None)
    if for_admin:
        out.update(status=d.status, sort_order=d.sort_order,
                   published_at=d.published_at.isoformat() if d.published_at else None)
    return out


def notice_json(n: Notice, with_body=False, for_admin=False):
    out = dict(id=n.id, slug=n.slug, title=n.title, tag=n.tag, summary=n.summary,
               notice_date=n.notice_date.isoformat(), is_pinned=n.is_pinned)
    if with_body or for_admin:
        out['body_html'] = n.body_html
    if for_admin:
        out['status'] = n.status
    return out


# ---------- public ----------
@public.get('/documents')
def list_documents(doc_type: str | None = Query(None, max_length=60), db: Session = Depends(get_db)):
    stmt = select(Document).where(Document.status == 'published')
    if doc_type:
        stmt = stmt.where(Document.doc_type == doc_type)
    docs = db.scalars(stmt.order_by(Document.sort_order, Document.created_at.desc())).all()
    types = db.scalars(select(Document.doc_type).where(Document.status == 'published').distinct().order_by(Document.doc_type)).all()
    return {'items': [document_json(d) for d in docs], 'types': types}


@public.get('/notices')
def list_notices(page: int = Query(1, ge=1), limit: int = Query(12, ge=1, le=50), db: Session = Depends(get_db)):
    stmt = select(Notice).where(Notice.status == 'published')
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(stmt.order_by(Notice.is_pinned.desc(), Notice.notice_date.desc(), Notice.created_at.desc())
                       .offset((page - 1) * limit).limit(limit)).all()
    return {'items': [notice_json(n) for n in items], 'total': total, 'page': page, 'limit': limit}


@public.get('/notices/{slug}')
def get_notice(slug: str, db: Session = Depends(get_db)):
    n = db.scalar(select(Notice).where(Notice.slug == slug, Notice.status == 'published'))
    if not n:
        raise HTTPException(404, 'Không tìm thấy thông báo.')
    return notice_json(n, with_body=True)


def _set_publication(obj, publish: bool):
    obj.status = 'published' if publish else 'draft'
    obj.published_at = utc_now() if publish else None


# ---------- admin: documents ----------
class DocumentCreate(BaseModel):
    title: str = Field(min_length=2, max_length=500)
    doc_type: str = Field(default='QUY ĐỊNH', min_length=1, max_length=60)
    description: str = ''
    external_url: str = Field(default='', max_length=1000)
    sort_order: int = 0


class DocumentPatch(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=500)
    doc_type: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = None
    external_url: str | None = Field(default=None, max_length=1000)
    sort_order: int | None = None


def _get_document(db: Session, doc_id: str) -> Document:
    d = db.get(Document, doc_id)
    if not d:
        raise HTTPException(404, 'Không tìm thấy tài liệu.')
    return d


@admin.get('/documents')
def admin_documents(db: Session = Depends(get_db), user: User = Depends(require_editor)):
    rows = db.scalars(select(Document).order_by(Document.sort_order, Document.created_at.desc())).all()
    return [document_json(d, True) for d in rows]


@admin.post('/documents', status_code=201)
def create_document(body: DocumentCreate, db: Session = Depends(get_db), user: User = Depends(require_editor)):
    data = body.model_dump()
    data['external_url'] = check_url(data['external_url'])
    d = Document(**data, status='draft')
    db.add(d)
    db.flush()
    db.add(AuditLog(actor_id=user.id, action='create_document', target_id=d.id))
    db.commit()
    return document_json(d, True)


@admin.patch('/documents/{doc_id}')
def patch_document(doc_id: str, body: DocumentPatch, db: Session = Depends(get_db), user: User = Depends(require_editor)):
    d = _get_document(db, doc_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is None:
            if k in {'title', 'doc_type', 'sort_order'}:
                raise HTTPException(422, f'Trường "{k}" không được để trống.')
            v = ''
        setattr(d, k, check_url(v) if k == 'external_url' else v)
    if d.status == 'published' and not d.file_key and not d.external_url:
        raise HTTPException(422, 'Tài liệu đã xuất bản phải có tệp hoặc liên kết ngoài.')
    db.add(AuditLog(actor_id=user.id, action='update_document', target_id=d.id))
    db.commit()
    return document_json(d, True)


@admin.post('/documents/{doc_id}/file')
async def upload_document_file(doc_id: str, file: UploadFile = File(...), db: Session = Depends(get_db),
                               user: User = Depends(require_editor)):
    d = _get_document(db, doc_id)
    ext = Path(file.filename or '').suffix.lower()
    if ext not in DOC_EXTENSIONS:
        raise HTTPException(422, 'Chỉ hỗ trợ PDF, Word (doc/docx) hoặc Excel (xls/xlsx).')
    root = Path(settings().media_root)
    (root / 'documents').mkdir(parents=True, exist_ok=True)
    key = f'documents/{uuid4().hex}{ext}'
    dest = root / key
    total = 0
    with dest.open('wb') as f:
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > DOC_MAX_BYTES:
                f.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, 'Tệp vượt quá 20 MB.')
            f.write(chunk)
    with dest.open('rb') as f:
        head = f.read(8)
    if not head.startswith(DOC_MAGIC[ext]):
        dest.unlink(missing_ok=True)
        raise HTTPException(422, 'Nội dung tệp không khớp với định dạng.')
    old = d.file_key
    d.file_key = key
    d.file_name = Path(file.filename).name[:300]
    db.commit()
    if old:
        (root / old).unlink(missing_ok=True)
    return document_json(d, True)


@admin.post('/documents/{doc_id}/publish')
def publish_document(doc_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    d = _get_document(db, doc_id)
    if not d.file_key and not d.external_url:
        raise HTTPException(422, 'Tài liệu cần có tệp đính kèm hoặc liên kết ngoài trước khi xuất bản.')
    _set_publication(d, True)
    db.add(AuditLog(actor_id=user.id, action='publish_document', target_id=d.id))
    db.commit()
    return {'ok': True}


@admin.post('/documents/{doc_id}/unpublish')
def unpublish_document(doc_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    d = _get_document(db, doc_id)
    _set_publication(d, False)
    db.add(AuditLog(actor_id=user.id, action='unpublish_document', target_id=d.id))
    db.commit()
    return {'ok': True}


@admin.delete('/documents/{doc_id}')
def delete_document(doc_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    d = _get_document(db, doc_id)
    key = d.file_key
    db.add(AuditLog(actor_id=user.id, action='delete_document', target_id=d.id))
    db.delete(d)
    db.commit()
    if key:
        (Path(settings().media_root) / key).unlink(missing_ok=True)
    return {'ok': True}


# ---------- admin: notices ----------
class NoticeCreate(BaseModel):
    title: str = Field(min_length=2, max_length=600)
    tag: str = Field(default='THÔNG BÁO', min_length=1, max_length=60)
    summary: str = ''
    body_html: str = ''
    notice_date: date | None = None
    is_pinned: bool = False


class NoticePatch(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=600)
    tag: str | None = Field(default=None, min_length=1, max_length=60)
    summary: str | None = None
    body_html: str | None = None
    notice_date: date | None = None
    is_pinned: bool | None = None


def _get_notice(db: Session, notice_id: str) -> Notice:
    n = db.get(Notice, notice_id)
    if not n:
        raise HTTPException(404, 'Không tìm thấy thông báo.')
    return n


@admin.get('/notices')
def admin_notices(db: Session = Depends(get_db), user: User = Depends(require_editor)):
    rows = db.scalars(select(Notice).order_by(Notice.notice_date.desc(), Notice.created_at.desc())).all()
    return [notice_json(n, for_admin=True) for n in rows]


@admin.post('/notices', status_code=201)
def create_notice(body: NoticeCreate, db: Session = Depends(get_db), user: User = Depends(require_editor)):
    data = body.model_dump()
    data['body_html'] = clean_html(data['body_html'])
    data['notice_date'] = data['notice_date'] or utc_now().date()
    n = Notice(**data, slug=f'{slugify(body.title)[:120]}-{uuid4().hex[:8]}', status='draft')
    db.add(n)
    db.flush()
    db.add(AuditLog(actor_id=user.id, action='create_notice', target_id=n.id))
    db.commit()
    return notice_json(n, for_admin=True)


@admin.patch('/notices/{notice_id}')
def patch_notice(notice_id: str, body: NoticePatch, db: Session = Depends(get_db), user: User = Depends(require_editor)):
    n = _get_notice(db, notice_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is None:
            if k in {'title', 'tag', 'notice_date', 'is_pinned'}:
                raise HTTPException(422, f'Trường "{k}" không được để trống.')
            v = ''
        setattr(n, k, clean_html(v) if k == 'body_html' else v)
    db.add(AuditLog(actor_id=user.id, action='update_notice', target_id=n.id))
    db.commit()
    return notice_json(n, for_admin=True)


@admin.post('/notices/{notice_id}/publish')
def publish_notice(notice_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    n = _get_notice(db, notice_id)
    if not n.summary.strip() and not n.body_html.strip():
        raise HTTPException(422, 'Thông báo cần có tóm tắt hoặc nội dung trước khi xuất bản.')
    _set_publication(n, True)
    db.add(AuditLog(actor_id=user.id, action='publish_notice', target_id=n.id))
    db.commit()
    return {'ok': True, 'slug': n.slug}


@admin.post('/notices/{notice_id}/unpublish')
def unpublish_notice(notice_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    n = _get_notice(db, notice_id)
    _set_publication(n, False)
    db.add(AuditLog(actor_id=user.id, action='unpublish_notice', target_id=n.id))
    db.commit()
    return {'ok': True}


@admin.delete('/notices/{notice_id}')
def delete_notice(notice_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    n = _get_notice(db, notice_id)
    db.add(AuditLog(actor_id=user.id, action='delete_notice', target_id=n.id))
    db.delete(n)
    db.commit()
    return {'ok': True}
