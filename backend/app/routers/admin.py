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
from ..models import Activity, Article, Document, Field, Issue, Notice, Setting, Subscriber, User
from ..security import check_login_allowed, make_token, record_fail, require_admin, verify_password
from ..util import slugify

router = APIRouter()


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
    return {"token": make_token(user), "email": user.email}


@router.get("/auth/me")
def me(user: User = Depends(require_admin)):
    return {"email": user.email, "role": user.role}


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


def crud(model, prefix: str, order, slug_from: str | None = None):
    r = APIRouter(prefix=prefix, dependencies=[Depends(require_admin)])

    def unique_slug(db: Session, base: str, exclude_id: int | None = None) -> str:
        base = slugify(base)
        slug, n = base, 2
        while True:
            hit = db.scalars(select(model).where(model.slug == slug)).first()
            if not hit or hit.id == exclude_id:
                return slug
            slug, n = f"{base}-{n}", n + 1

    @r.get("")
    def list_(request: Request, db: Session = Depends(get_db)):
        stmt = select(model)
        for k, v in request.query_params.items():
            if k in model.__table__.columns and v != "":
                col = model.__table__.columns[k]
                pt = col.type.python_type
                stmt = stmt.where(getattr(model, k) == (int(v) if pt is int else v == "true" if pt is bool else v))
        return [to_dict(o) for o in db.scalars(stmt.order_by(*order)).unique().all()]

    @r.post("", status_code=201)
    def create(data: dict, db: Session = Depends(get_db)):
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
    def update(obj_id: int, data: dict, db: Session = Depends(get_db)):
        obj = db.get(model, obj_id)
        if not obj:
            raise HTTPException(404, "Không tìm thấy")
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

    @r.delete("/{obj_id}", status_code=204)
    def delete(obj_id: int, db: Session = Depends(get_db)):
        obj = db.get(model, obj_id)
        if not obj:
            raise HTTPException(404, "Không tìm thấy")
        db.delete(obj)
        db.commit()

    return r


router.include_router(crud(Issue, "/issues", [Issue.number.desc()], slug_from="label"))
router.include_router(crud(Article, "/articles", [Article.issue_id.desc(), Article.sort_order, Article.id], slug_from="title"))
router.include_router(crud(Field, "/fields", [Field.sort_order, Field.id]))
router.include_router(crud(Activity, "/activities", [Activity.event_date.desc().nullslast()]))
router.include_router(crud(Notice, "/notices", [Notice.notice_date.desc().nullslast()]))
router.include_router(crud(Document, "/documents", [Document.sort_order, Document.id]))
router.include_router(crud(Setting, "/settings", [Setting.key]))


@router.get("/subscribers", dependencies=[Depends(require_admin)])
def subscribers(db: Session = Depends(get_db)):
    return [to_dict(s) for s in db.scalars(select(Subscriber).order_by(Subscriber.id.desc()))]


@router.delete("/subscribers/{sid}", status_code=204, dependencies=[Depends(require_admin)])
def delete_subscriber(sid: int, db: Session = Depends(get_db)):
    s = db.get(Subscriber, sid)
    if s:
        db.delete(s)
        db.commit()


# ---------- upload ----------
ALLOWED = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx", ".xls", ".xlsx"}


@router.post("/upload", dependencies=[Depends(require_admin)])
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
