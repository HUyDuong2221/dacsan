"""Quản lý người dùng và phân quyền (chỉ quản trị viên)."""
import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..services import audit, mailer
from ..db import get_db
from ..models import User
from ..security import RESET_MINUTES, ROLES, hash_password, make_reset_token, require_roles

router = APIRouter(prefix="/users")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "is_active": u.is_active,
        "pending": bool(u.pending),
        "status_label": "Chờ duyệt" if u.pending else ("Đang hoạt động" if u.is_active else "Đã khóa"),
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
def create_user(body: UserIn, request: Request, db: Session = Depends(get_db), me: User = Depends(require_roles("admin"))):
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
    audit.note(request, f"{u.email} ({u.role})", entity_id=u.id)
    return user_dict(u)


@router.put("/{user_id}")
def update_user(user_id: int, body: UserIn, request: Request, bg: BackgroundTasks, db: Session = Depends(get_db),
                me: User = Depends(require_roles("admin"))):
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
    approved = bool(u.pending and new_active)  # tài khoản tự đăng ký được quản trị viên bật hoạt động = duyệt
    mail_ids: list[int] = []
    if approved:
        u.pending = False
        text, page = mailer.render(db, "Tài khoản đã được duyệt", [
            f"Chào {u.full_name or u.email},",
            f"Quản trị viên đã duyệt tài khoản của bạn trên trang quản trị Đặc san (vai trò: "
            f"{ {'admin': 'Quản trị viên', 'editor': 'Biên tập viên'}.get(u.role, 'Cộng tác viên') }).",
            "Đăng nhập bằng email và mật khẩu bạn đã đặt khi đăng ký.",
        ], ("Đăng nhập", mailer.site_url("/admin")))
        mail_ids.append(mailer.queue(db, u.email, "Tài khoản Đặc san KH&PT của bạn đã được duyệt", text, "account_approved", page).id)
    changes = [k for k in ("email", "full_name", "role", "is_active") if getattr(body, k) is not None]
    audit.note(request, f"{u.email}: {', '.join(changes + (['mật khẩu'] if body.password else [])) or 'không đổi'}"
               + ("" if u.is_active else " (đang khóa)") + (" · đã duyệt đăng ký" if approved else ""))
    db.commit()
    if mail_ids:
        bg.add_task(mailer.deliver, mail_ids)
    return user_dict(u)


@router.post("/{user_id}/reset-link")
def send_reset_link(user_id: int, request: Request, bg: BackgroundTasks, db: Session = Depends(get_db),
                    me: User = Depends(require_roles("admin"))):
    """Quản trị viên gửi liên kết đặt lại mật khẩu cho một người dùng (cùng luồng với "Quên mật khẩu").
    Trả thêm liên kết để chuyển tay khi chưa cấu hình SMTP."""
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Không tìm thấy người dùng")
    if u.pending or not u.is_active:
        raise HTTPException(422, "Chỉ đặt lại mật khẩu cho tài khoản đang hoạt động")
    link = mailer.site_url(f"/admin/dat-lai-mat-khau?token={make_reset_token(u)}")
    text, page = mailer.render(db, "Đặt lại mật khẩu", [
        f"Chào {u.full_name or u.email},",
        "Quản trị viên đã gửi cho bạn liên kết đặt lại mật khẩu tài khoản quản trị Đặc san. Bấm nút dưới đây để đặt mật khẩu mới.",
        f"Liên kết có hiệu lực trong {RESET_MINUTES} phút và chỉ dùng được một lần.",
    ], ("Đặt mật khẩu mới", link), "Nếu bạn không mong đợi email này, hãy bỏ qua; mật khẩu hiện tại vẫn giữ nguyên.")
    row = mailer.queue(db, u.email, "Đặt lại mật khẩu tài khoản Đặc san KH&PT", text, "reset_password", page)
    audit.note(request, f"Gửi liên kết đặt lại mật khẩu cho {u.email}")
    db.commit()
    bg.add_task(mailer.deliver, [row.id])
    return {"message": f"Đã gửi liên kết đặt lại mật khẩu tới {u.email}", "link": link, "minutes": RESET_MINUTES}


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db), me: User = Depends(require_roles("admin"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Không tìm thấy người dùng")
    if u.id == me.id:
        raise HTTPException(422, "Bạn không thể tự xóa tài khoản của mình")
    if u.role == "admin" and u.is_active and _active_admins(db, u.id) == 0:
        raise HTTPException(422, "Phải còn ít nhất một quản trị viên đang hoạt động")
    audit.note(request, u.email)
    db.delete(u)
    db.commit()
