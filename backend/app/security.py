import ipaddress
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import hashlib

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User

bearer = HTTPBearer(auto_error=False)

# Vai trò:
#   admin       - toàn quyền, quản lý người dùng, cấu hình, danh sách đăng ký email
#   editor      - biên tập viên: số đặc san, mục lục, chuyên mục, hoạt động, bài viết, bài gửi; được công bố/xóa
#   contributor - cộng tác viên: nhập/sửa mục lục và toàn văn của số CHƯA công bố; không công bố, không xóa
ROLES = ("admin", "editor", "contributor")
# nhóm vai trò dùng với require_roles(*...)
ADMIN = ("admin",)
EDIT = ("admin", "editor")
STAFF = ROLES


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except ValueError:
        return False


def make_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_hours)
    return jwt.encode({"sub": str(user.id), "exp": exp}, settings.jwt_secret, "HS256")


PREVIEW_HOURS = 2
RESET_MINUTES = 60


def _pw_fingerprint(user: User) -> str:
    # đổi mật khẩu là đổi dấu vân tay, nên link đặt lại mật khẩu chỉ dùng được một lần
    return hashlib.sha256(user.password_hash.encode()).hexdigest()[:16]


def make_reset_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=RESET_MINUTES)
    return jwt.encode({"purpose": "reset", "uid": user.id, "ph": _pw_fingerprint(user), "exp": exp}, settings.jwt_secret, "HS256")


def reset_token_user(token: str, db: Session) -> User | None:
    try:
        data = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if data.get("purpose") != "reset":
        return None
    user = db.get(User, data.get("uid") or 0)
    if not user or not user.is_active or user.pending or data.get("ph") != _pw_fingerprint(user):
        return None
    return user



def make_preview_token(issue_id: int) -> str:
    """Token xem trước một số CHƯA công bố (không cần đăng nhập khi mở liên kết, hết hạn sau PREVIEW_HOURS giờ)."""
    exp = datetime.now(timezone.utc) + timedelta(hours=PREVIEW_HOURS)
    return jwt.encode({"purpose": "preview", "issue": issue_id, "exp": exp}, settings.jwt_secret, "HS256")


def preview_issue_id(token: str | None) -> int | None:
    if not token:
        return None
    try:
        data = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return data.get("issue") if data.get("purpose") == "preview" else None


def current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    """Người dùng đăng nhập hợp lệ. Vai trò và trạng thái được đọc lại từ DB ở mỗi request nên có hiệu lực ngay."""
    if not cred:
        raise HTTPException(401, "Chưa đăng nhập")
    try:
        data = jwt.decode(cred.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Phiên đăng nhập không hợp lệ")
    if data.get("purpose") or not str(data.get("sub", "")).isdigit():  # token xem trước... không phải phiên đăng nhập
        raise HTTPException(401, "Phiên đăng nhập không hợp lệ")
    user = db.get(User, int(data["sub"]))
    if not user or not user.is_active:
        raise HTTPException(401, "Tài khoản không tồn tại hoặc đã bị khóa")
    return user


def require_roles(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "Bạn không có quyền thực hiện thao tác này")
        return user

    return dep


class Limiter:
    """Giới hạn số lần theo khóa (IP) trong một cửa sổ thời gian. Bộ nhớ tiến trình, đủ cho 1 instance."""

    def __init__(self, limit: int, window: int, message: str):
        self.limit, self.window, self.message = limit, window, message
        self.hits: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time.time()
        self.hits[key] = [t for t in self.hits[key] if now - t < self.window]
        if len(self.hits[key]) >= self.limit:
            raise HTTPException(429, self.message)

    def record(self, key: str) -> None:
        self.hits[key].append(time.time())

    def reset(self) -> None:
        self.hits.clear()


login_limiter = Limiter(8, 900, "Đăng nhập sai quá nhiều lần, thử lại sau ít phút")
# theo từng tài khoản (email): chặn dò mật khẩu kể cả khi kẻ tấn công đổi IP
account_limiter = Limiter(20, 900, "Tài khoản này bị tạm khóa đăng nhập do sai mật khẩu nhiều lần, thử lại sau 15 phút")
submit_limiter = Limiter(5, 3600, "Bạn gửi bài quá nhiều lần, vui lòng thử lại sau")
track_limiter = Limiter(20, 900, "Tra cứu quá nhiều lần, vui lòng thử lại sau")
forgot_limiter = Limiter(5, 3600, "Bạn đã yêu cầu đặt lại mật khẩu nhiều lần, vui lòng thử lại sau")
register_limiter = Limiter(5, 3600, "Bạn đã đăng ký nhiều lần, vui lòng thử lại sau")
subscribe_limiter = Limiter(10, 3600, "Bạn đã đăng ký nhận tin nhiều lần, vui lòng thử lại sau")


def _internal(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return ip.is_private or ip.is_loopback


def client_ip(request: Request) -> str:
    """IP thật của người dùng.

    Trình duyệt gọi backend qua rewrite của Next.js (và có thể thêm nginx phía trước), nên request.client.host là IP
    của container frontend, chung cho mọi người. IP thật nằm trong X-Forwarded-For. Chỉ tin header này khi request
    đến từ địa chỉ nội bộ, và lấy phần tử thứ `forwarded_hops` tính từ phải: phần bên trái do client tự gửi được,
    phần bên phải do proxy tin cậy ghi vào.
    """
    host = request.client.host if request.client else "?"
    hops = settings.forwarded_hops
    xff = request.headers.get("x-forwarded-for", "")
    if hops > 0 and xff and _internal(host):
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if len(parts) >= hops:
            return parts[-hops][:64]
    return host


def check_login_allowed(request: Request, email: str = "") -> str:
    ip = client_ip(request)
    login_limiter.check(ip)
    if email:
        account_limiter.check(email)
    return ip


def record_fail(ip: str, email: str = "") -> None:
    login_limiter.record(ip)
    if email:
        account_limiter.record(email)


def reset_fails() -> None:
    for lim in (login_limiter, account_limiter, submit_limiter, track_limiter, forgot_limiter, register_limiter, subscribe_limiter):
        lim.reset()
