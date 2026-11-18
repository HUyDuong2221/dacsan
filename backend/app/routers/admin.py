import os
import secrets
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Activity, TocEntry, Document, Field, Issue, Notice, Setting, Subscriber, User
from ..security import check_login_allowed, current_user, hash_password, make_token, record_fail, require_roles, verify_password
from ..util import slugify

router = APIRouter()

ADMIN = ("admin",)
EDIT = ("admin", "editor")
STAFF = ("admin", "editor", "contributor")


# ---------- đăng nhập ----------
class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    ip = check_login_allowed(request)
    user = db.scalars(select(User).where(User.email == body.email.strip().lower())).first()
    if not user or not verify_password(body.password, user.password_hash):
        record_fail(ip)
        raise HTTPException(401, "Sai email hoặc mật khẩu")
    if not user.is_active:
        raise HTTPException(401, "Tài khoản đã bị khóa, hãy liên hệ quản trị viên")
    return {"token": make_token(user), "email": user.email, "role": user.role, "full_name": user.full_name}


@router.get("/auth/me")
def me(user: User = Depends(current_user)):
    return {"email": user.email, "role": user.role, "full_name": user.full_name}


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


@router.post("/auth/change-password")
def change_password(body: ChangePasswordIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(422, "Mật khẩu hiện tại không đúng")
    if len(body.new_password) < 8:
        raise HTTPException(422, "Mật khẩu mới phải có ít nhất 8 ký tự")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}


# ---------- CRUD tổng quát ----------
READONLY = {"id", "created_at", "updated_at"}


def to_dict(obj) -> dict:
    out = {}
    for c in obj.__table__.columns:
        v = getattr(obj, c.name)
        out[c.name] = v.isoformat() if isinstance(v, (date, datetime)) else v
    return out


def coerce(model, data: dict, partial: bool) -> dict:
    out = {}
    if not partial:
        for c in model.__table__.columns:
            if (
                not c.nullable and c.default is None and c.server_default is None
                and c.name not in READONLY and c.name != "slug" and c.name not in data
            ):
                raise HTTPException(422, f"Thiếu trường: {c.name}")
    for c in model.__table__.columns:
        if c.name in READONLY or c.name not in data:
            continue
        v = data[c.name]
        pt = c.type.python_type
        if v == "" and pt is not str:
            v = None
        if v is None:
            if not c.nullable and c.default is None and c.server_default is None:
                raise HTTPException(422, f"Thiếu trường: {c.name}")
            if not c.nullable:
                continue
        elif pt is date:
            try:
                v = date.fromisoformat(str(v)[:10])
            except ValueError:
                raise HTTPException(422, f"Ngày không hợp lệ: {c.name}")
        elif pt is int and not isinstance(v, bool):
            try:
                v = int(v)
            except (TypeError, ValueError):
                raise HTTPException(422, f"Số không hợp lệ: {c.name}")
        elif pt is bool:
            v = bool(v)
        elif pt is str:
            v = str(v).strip() if c.name != "body" and c.name != "value" else str(v)
        out[c.name] = v
    return out


def prepare_issue(data: dict, existing: Issue | None) -> None:
    """Nhãn ("Số 17 (6-2026)") và năm tự sinh từ Số đặc san + Ngày đăng, không nhập tay."""
    if "number" not in data and "published_at" not in data:
        return
    number = data.get("number", existing.number if existing else None)
    raw = data.get("published_at", existing.published_at if existing else None)
    try:
        n = int(number)
        d = raw if isinstance(raw, date) else (date.fromisoformat(str(raw)[:10]) if raw else None)
    except (TypeError, ValueError):
        return  # để coerce() báo lỗi 422 đúng trường
    data["label"] = f"Số {n:02d}" + (f" ({d.month}-{d.year})" if d else "")
    data["year"] = d.year if d else (existing.year if existing else date.today().year)


def guard_entry(user: User, db: Session, data: dict, obj: TocEntry | None) -> None:
    """Cộng tác viên chỉ được nhập/sửa mục lục của số CHƯA công bố."""
    if user.role != "contributor":
        return
    ids = {obj.issue_id} if obj else set()
    try:
        if data.get("issue_id") not in (None, ""):
            ids.add(int(data["issue_id"]))
    except (TypeError, ValueError):
        pass
    for i in ids:
        issue = db.get(Issue, i)
        if issue and issue.published:
            raise HTTPException(403, "Số này đã công bố, chỉ biên tập viên được sửa")


def crud(model, prefix: str, order, slug_from: str | None = None, prepare=None,
         read=STAFF, write=EDIT, remove=EDIT, guard=None):
    r = APIRouter(prefix=prefix)

    def unique_slug(db: Session, base: str, exclude_id: int | None = None) -> str:
        base = slugify(base)
        slug, n = base, 2
        while True:
            hit = db.scalars(select(model).where(model.slug == slug)).first()
            if not hit or hit.id == exclude_id:
                return slug
            slug, n = f"{base}-{n}", n + 1

    @r.get("", dependencies=[Depends(require_roles(*read))])
    def list_(request: Request, db: Session = Depends(get_db)):
        stmt = select(model)
        for k, v in request.query_params.items():
            if k in model.__table__.columns and v != "":
                col = model.__table__.columns[k]
                pt = col.type.python_type
                stmt = stmt.where(getattr(model, k) == (int(v) if pt is int else v == "true" if pt is bool else v))
        return [to_dict(o) for o in db.scalars(stmt.order_by(*order)).unique().all()]

    @r.post("", status_code=201)
    def create(data: dict, db: Session = Depends(get_db), user: User = Depends(require_roles(*write))):
        if guard:
            guard(user, db, data, None)
        if prepare:
            prepare(data, None)
        vals = coerce(model, data, partial=False)
        if slug_from:
            vals["slug"] = unique_slug(db, data.get("slug") or data.get(slug_from) or "muc")
        obj = model(**vals)
        db.add(obj)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Dữ liệu trùng hoặc tham chiếu không hợp lệ")
        db.refresh(obj)
        return to_dict(obj)

    @r.put("/{obj_id}")
    def update(obj_id: int, data: dict, db: Session = Depends(get_db), user: User = Depends(require_roles(*write))):
        obj = db.get(model, obj_id)
        if not obj:
            raise HTTPException(404, "Không tìm thấy")
        if guard:
            guard(user, db, data, obj)
        if prepare:
            prepare(data, obj)
        for k, v in coerce(model, data, partial=True).items():
            setattr(obj, k, v)
        if slug_from and not obj.slug:
            obj.slug = unique_slug(db, getattr(obj, slug_from), obj.id)
        elif slug_from and data.get("slug") and data["slug"] != obj.slug:
            obj.slug = unique_slug(db, data["slug"], obj.id)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Dữ liệu trùng hoặc tham chiếu không hợp lệ")
        return to_dict(obj)

    @r.delete("/{obj_id}", status_code=204, dependencies=[Depends(require_roles(*remove))])
    def delete(obj_id: int, db: Session = Depends(get_db)):
        obj = db.get(model, obj_id)
        if not obj:
            raise HTTPException(404, "Không tìm thấy")
        db.delete(obj)
        db.commit()

    return r


router.include_router(crud(Issue, "/issues", [Issue.number.desc()], slug_from="label", prepare=prepare_issue))
router.include_router(crud(TocEntry, "/toc-entries", [TocEntry.issue_id.desc(), TocEntry.sort_order, TocEntry.id], slug_from="title",
                           write=STAFF, guard=guard_entry))
router.include_router(crud(Field, "/fields", [Field.sort_order, Field.id]))
router.include_router(crud(Activity, "/activities", [Activity.event_date.desc().nullslast()], read=EDIT))
router.include_router(crud(Notice, "/notices", [Notice.notice_date.desc().nullslast()], read=EDIT))
router.include_router(crud(Document, "/documents", [Document.sort_order, Document.id], read=EDIT))
router.include_router(crud(Setting, "/settings", [Setting.key], read=ADMIN, write=ADMIN, remove=ADMIN))


@router.get("/subscribers", dependencies=[Depends(require_roles(*ADMIN))])
def subscribers(db: Session = Depends(get_db)):
    return [to_dict(s) for s in db.scalars(select(Subscriber).order_by(Subscriber.id.desc()))]


@router.delete("/subscribers/{sid}", status_code=204, dependencies=[Depends(require_roles(*ADMIN))])
def delete_subscriber(sid: int, db: Session = Depends(get_db)):
    s = db.get(Subscriber, sid)
    if s:
        db.delete(s)
        db.commit()


# ---------- upload ----------
ALLOWED = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx", ".xls", ".xlsx"}


@router.post("/upload", dependencies=[Depends(require_roles(*STAFF))])
async def upload(file: UploadFile):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED:
        raise HTTPException(415, f"Định dạng không được phép: {ext or '?'}")
    os.makedirs(settings.media_dir, exist_ok=True)
    name = f"{secrets.token_hex(8)}{ext}"
    limit = settings.max_upload_mb * 1024 * 1024
    size = 0
    with open(os.path.join(settings.media_dir, name), "wb") as f:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > limit:
                f.close()
                os.remove(f.name)
                raise HTTPException(413, f"Tệp vượt quá {settings.max_upload_mb}MB")
            f.write(chunk)
    return {"url": f"/media/{name}"}


class MergeIn(BaseModel):
    target_id: int


@router.post("/fields/{field_id}/merge", dependencies=[Depends(require_roles(*EDIT))])
def merge_field(field_id: int, body: MergeIn, db: Session = Depends(get_db)):
    """Gộp chuyên mục vào chuyên mục khác: chuyển mọi dòng mục lục sang chuyên mục đích rồi xóa chuyên mục nguồn."""
    src, dst = db.get(Field, field_id), db.get(Field, body.target_id)
    if not src or not dst:
        raise HTTPException(404, "Không tìm thấy chuyên mục")
    if src.id == dst.id:
        raise HTTPException(422, "Chọn một chuyên mục khác để gộp")
    moved = db.query(TocEntry).filter(TocEntry.field_id == src.id).update({TocEntry.field_id: dst.id})
    db.delete(src)
    db.commit()
    return {"moved": moved}


# ---------- mục lục từ PDF ----------
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
    url = issue.pdf_url or ""
    if not url.startswith("/media/"):
        raise HTTPException(422, "Số này chưa có file PDF tải lên từ trang quản trị")
    path = os.path.join(settings.media_dir, os.path.basename(url))
    if not os.path.isfile(path):
        raise HTTPException(422, "Không tìm thấy file PDF trên máy chủ, hãy tải lại")
    return issue, path


@router.post("/issues/{issue_id}/toc/preview", dependencies=[Depends(require_roles(*EDIT))])
def toc_preview(issue_id: int, db: Session = Depends(get_db)):
    from ..toc import extract_toc

    _, path = _issue_pdf_path(db, issue_id)
    try:
        return extract_toc(path)
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.post("/issues/{issue_id}/toc/import", dependencies=[Depends(require_roles(*EDIT))])
def toc_import(issue_id: int, body: TocImportIn, db: Session = Depends(get_db)):
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
    return {"created": created, "skipped": skipped}
