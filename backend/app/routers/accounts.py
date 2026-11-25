"""Tài khoản (/auth): đăng nhập, thông tin phiên, đổi mật khẩu; và các thao tác không cần đăng nhập:
quên mật khẩu, đặt lại mật khẩu, tự đăng ký (chờ quản trị viên duyệt).

Các phản hồi không cho biết một email có tài khoản hay không (chống dò tài khoản).
"""
import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..services import audit, mailer
from ..db import get_db
from ..models import User
from ..security import (RESET_MINUTES, check_login_allowed, client_ip, current_user, forgot_limiter, hash_password,
                        make_reset_token, make_token, record_fail, register_limiter, reset_token_user, verify_password)
from .users import EMAIL_RE

router = APIRouter(prefix="/auth")
GENERIC_FORGOT = "Nếu email này có tài khoản đang hoạt động, hệ thống đã gửi hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (cả mục Thư rác)."


# ---------- đăng nhập ----------
class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    email = body.email.strip().lower()[:255]
    ip = check_login_allowed(request, email)
    user = db.scalars(select(User).where(User.email == email)).first()
    audit.note(request, email=body.email.strip().lower()[:255], user_id=user.id if user else None)
    if not user or not verify_password(body.password, user.password_hash):
        record_fail(ip, email)
        audit.note(request, "Sai email hoặc mật khẩu")
        raise HTTPException(401, "Sai email hoặc mật khẩu")
    if user.pending:
        audit.note(request, "Tài khoản đang chờ duyệt")
        raise HTTPException(401, "Tài khoản đang chờ quản trị viên duyệt. Bạn sẽ nhận email khi được duyệt.")
    if not user.is_active:
        audit.note(request, "Tài khoản đã bị khóa")
        raise HTTPException(401, "Tài khoản đã bị khóa, hãy liên hệ quản trị viên")
    return {"token": make_token(user), "email": user.email, "role": user.role, "full_name": user.full_name}


def profile_dict(user: User) -> dict:
    return {"email": user.email, "role": user.role, "full_name": user.full_name, "phone": user.phone or "",
            "position": user.position or "", "created_at": user.created_at.isoformat() if user.created_at else None}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return profile_dict(user)


class ProfileIn(BaseModel):
    full_name: str
    phone: str = ""
    position: str = ""


@router.put("/me")
def update_me(body: ProfileIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    name = body.full_name.strip()
    phone = body.phone.strip()
    if not name:
        raise HTTPException(422, "Họ tên không được để trống")
    if phone and not re.fullmatch(r"[0-9+\-\s().]{8,20}", phone):
        raise HTTPException(422, "Số điện thoại không hợp lệ")
    user.full_name = name[:200]
    user.phone = phone
    user.position = body.position.strip()[:200]
    audit.note(request, f"Cập nhật hồ sơ {user.email}", user_id=user.id, email=user.email)
    db.commit()
    return profile_dict(user)


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


@router.post("/change-password")
def change_password(body: ChangePasswordIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(422, "Mật khẩu hiện tại không đúng")
    if len(body.new_password) < 8:
        raise HTTPException(422, "Mật khẩu mới phải có ít nhất 8 ký tự")
    if verify_password(body.new_password, user.password_hash):
        raise HTTPException(422, "Mật khẩu mới phải khác mật khẩu hiện tại")
    user.password_hash = hash_password(body.new_password)
    audit.note(request, f"Đổi mật khẩu tài khoản {user.email}", user_id=user.id, email=user.email)
    db.commit()
    return {"ok": True}


# ---------- quên mật khẩu / tự đăng ký ----------
class ForgotIn(BaseModel):
    email: str


@router.post("/forgot-password")
def forgot_password(body: ForgotIn, request: Request, bg: BackgroundTasks, db: Session = Depends(get_db)):
    ip = client_ip(request)
    forgot_limiter.check(ip)
    forgot_limiter.record(ip)
    email = body.email.strip().lower()[:255]
    audit.note(request, email, email=email)
    user = db.scalars(select(User).where(User.email == email)).first() if EMAIL_RE.match(email) else None
    if user and user.is_active and not user.pending:
        link = mailer.site_url(f"/admin/dat-lai-mat-khau?token={make_reset_token(user)}")
        text, page = mailer.render(db, "Đặt lại mật khẩu", [
            f"Chào {user.full_name or user.email},",
            "Có yêu cầu đặt lại mật khẩu cho tài khoản quản trị Đặc san của bạn. Bấm nút dưới đây để đặt mật khẩu mới.",
            f"Liên kết có hiệu lực trong {RESET_MINUTES} phút và chỉ dùng được một lần.",
        ], ("Đặt mật khẩu mới", link), "Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu hiện tại vẫn giữ nguyên.")
        row = mailer.queue(db, user.email, "Đặt lại mật khẩu tài khoản Đặc san KH&PT", text, "reset_password", page)
        db.commit()
        bg.add_task(mailer.deliver, [row.id])
    return {"message": GENERIC_FORGOT}


class ResetIn(BaseModel):
    token: str
    password: str


@router.post("/reset-password")
def reset_password(body: ResetIn, request: Request, db: Session = Depends(get_db)):
    user = reset_token_user(body.token, db)
    if not user:
        raise HTTPException(400, "Liên kết đặt lại mật khẩu không hợp lệ, đã hết hạn hoặc đã được dùng. Hãy yêu cầu lại.")
    if len(body.password) < 8:
        raise HTTPException(422, "Mật khẩu mới phải có ít nhất 8 ký tự")
    user.password_hash = hash_password(body.password)
    audit.note(request, user.email, user_id=user.id, email=user.email)
    db.commit()
    return {"message": "Đã đặt mật khẩu mới. Bạn có thể đăng nhập."}


class RegisterIn(BaseModel):
    email: str
    full_name: str
    password: str
    note: str = ""  # đơn vị công tác / lý do, gửi kèm thư báo cho quản trị viên
    website: str = ""  # ô bẫy cho bot


@router.post("/register", status_code=201)
def register(body: RegisterIn, request: Request, bg: BackgroundTasks, db: Session = Depends(get_db)):
    ip = client_ip(request)
    register_limiter.check(ip)
    ok = {"message": "Đã gửi yêu cầu. Tài khoản sẽ dùng được sau khi quản trị viên duyệt; bạn sẽ nhận email khi được duyệt."}
    if body.website.strip():
        return ok
    email, name, note = body.email.strip().lower(), " ".join(body.full_name.split()), body.note.strip()[:500]
    if not EMAIL_RE.match(email) or len(email) > 255:
        raise HTTPException(422, "Email không hợp lệ")
    if not 2 <= len(name) <= 200:
        raise HTTPException(422, "Vui lòng nhập họ tên")
    if len(body.password) < 8:
        raise HTTPException(422, "Mật khẩu phải có ít nhất 8 ký tự")
    register_limiter.record(ip)
    audit.note(request, f"{email} ({name}){': ' + note if note else ''}", email=email)
    if db.scalars(select(User).where(User.email == email)).first():
        return ok  # không tiết lộ email đã có tài khoản
    u = User(email=email, full_name=name, role="contributor", is_active=False, pending=True, password_hash=hash_password(body.password))
    db.add(u)
    db.flush()
    admins = db.scalars(select(User).where(User.role == "admin", User.is_active.is_(True))).all()
    text, page = mailer.render(db, "Có tài khoản mới chờ duyệt", [
        f"{name} ({email}) vừa đăng ký tài khoản cộng tác viên trên trang quản trị Đặc san.",
        *([f"Ghi chú của người đăng ký: {note}"] if note else []),
        "Vào mục Người dùng, kiểm tra thông tin rồi đánh dấu “Đang hoạt động” để duyệt (có thể đổi vai trò), hoặc xóa nếu không hợp lệ.",
    ], ("Mở trang quản trị", mailer.site_url("/admin")))
    ids = [mailer.queue(db, a.email, f"Tài khoản chờ duyệt: {name}", text, "register_admin", page).id for a in admins]
    db.commit()
    bg.add_task(mailer.deliver, ids)
    return ok
