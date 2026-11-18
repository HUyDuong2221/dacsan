"""Quản lý người dùng và phân quyền (chỉ quản trị viên)."""
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..security import ROLES, hash_password, require_roles

router = APIRouter(prefix="/users")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


class UserIn(BaseModel):
    email: str | None = None
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None


def _check(body: UserIn, creating: bool) -> None:
    if body.email is not None:
        e = body.email.strip().lower()
        if not EMAIL_RE.match(e) or len(e) > 255:
            raise HTTPException(422, "Email không hợp lệ")
    elif creating:
        raise HTTPException(422, "Thiếu email")
    if body.role is not None and body.role not in ROLES:
        raise HTTPException(422, f"Vai trò phải là một trong: {', '.join(ROLES)}")
    if creating and not body.password:
        raise HTTPException(422, "Thiếu mật khẩu")
    if body.password and len(body.password) < 8:
        raise HTTPException(422, "Mật khẩu phải có ít nhất 8 ký tự")


def _active_admins(db: Session, exclude_id: int | None = None) -> int:
    q = select(func.count()).select_from(User).where(User.role == "admin", User.is_active.is_(True))
    if exclude_id is not None:
        q = q.where(User.id != exclude_id)
    return db.scalar(q) or 0


@router.get("")
def list_users(db: Session = Depends(get_db), me: User = Depends(require_roles("admin"))):
    return [user_dict(u) for u in db.scalars(select(User).order_by(User.id))]


@router.post("", status_code=201)
def create_user(body: UserIn, db: Session = Depends(get_db), me: User = Depends(require_roles("admin"))):
    _check(body, creating=True)
    email = body.email.strip().lower()
    if db.scalars(select(User).where(User.email == email)).first():
        raise HTTPException(409, "Email này đã có tài khoản")
    u = User(
        email=email,
        full_name=(body.full_name or "").strip()[:200],
        role=body.role or "contributor",
        is_active=True if body.is_active is None else body.is_active,
        password_hash=hash_password(body.password),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return user_dict(u)


@router.put("/{user_id}")
def update_user(user_id: int, body: UserIn, db: Session = Depends(get_db), me: User = Depends(require_roles("admin"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Không tìm thấy người dùng")
    _check(body, creating=False)
    new_role = body.role if body.role is not None else u.role
    new_active = body.is_active if body.is_active is not None else u.is_active
    if u.id == me.id and (new_role != "admin" or not new_active):
        raise HTTPException(422, "Bạn không thể tự hạ quyền hoặc tự khóa tài khoản của mình")
    if u.role == "admin" and u.is_active and (new_role != "admin" or not new_active) and _active_admins(db, u.id) == 0:
        raise HTTPException(422, "Phải còn ít nhất một quản trị viên đang hoạt động")
    if body.email is not None:
        email = body.email.strip().lower()
        other = db.scalars(select(User).where(User.email == email, User.id != u.id)).first()
        if other:
            raise HTTPException(409, "Email này đã có tài khoản")
        u.email = email
    if body.full_name is not None:
        u.full_name = body.full_name.strip()[:200]
    u.role, u.is_active = new_role, new_active
    if body.password:  # để trống = giữ nguyên mật khẩu
        u.password_hash = hash_password(body.password)
    db.commit()
    return user_dict(u)


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), me: User = Depends(require_roles("admin"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Không tìm thấy người dùng")
    if u.id == me.id:
        raise HTTPException(422, "Bạn không thể tự xóa tài khoản của mình")
    if u.role == "admin" and u.is_active and _active_admins(db, u.id) == 0:
        raise HTTPException(422, "Phải còn ít nhất một quản trị viên đang hoạt động")
    db.delete(u)
    db.commit()
