"""Factory CRUD tổng quát cho các mục quản trị đơn giản (dựa trên metadata cột SQLAlchemy).

crud(model, prefix, order, ...) trả về một APIRouter với GET (danh sách, lọc theo ?cột=giá-trị), POST, PUT, DELETE.
coerce() đổi kiểu và kiểm tra trường bắt buộc; prepare= sinh trường dẫn xuất; guard= kiểm tra quyền theo dữ liệu;
after(db, obj, request, bg) chạy sau khi tạo/sửa thành công (ví dụ tự gửi thư báo khi công bố số).
Mỗi thao tác ghi tên đối tượng vào nhật ký hoạt động (audit.note).
"""
from datetime import date, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..security import EDIT, STAFF, require_roles
from ..services import audit
from ..services.util import slugify

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


def crud(model, prefix: str, order, slug_from: str | None = None, prepare=None,
         read=STAFF, write=EDIT, remove=EDIT, guard=None, after=None):
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
    def create(data: dict, request: Request, bg: BackgroundTasks, db: Session = Depends(get_db),
               user: User = Depends(require_roles(*write))):
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
        audit.note(request, audit.display_name(obj), entity_id=obj.id)
        if after:
            after(db, obj, request, bg)
        return to_dict(obj)

    @r.put("/{obj_id}")
    def update(obj_id: int, data: dict, request: Request, bg: BackgroundTasks, db: Session = Depends(get_db),
               user: User = Depends(require_roles(*write))):
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
        audit.note(request, audit.display_name(obj))
        if after:
            after(db, obj, request, bg)
        return to_dict(obj)

    @r.delete("/{obj_id}", status_code=204, dependencies=[Depends(require_roles(*remove))])
    def delete(obj_id: int, request: Request, db: Session = Depends(get_db)):
        obj = db.get(model, obj_id)
        if not obj:
            raise HTTPException(404, "Không tìm thấy")
        audit.note(request, audit.display_name(obj))
        db.delete(obj)
        db.commit()

    return r
