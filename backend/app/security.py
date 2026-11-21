import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

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
#   editor      - biên tập viên: số đặc san, mục lục, chuyên mục, hoạt động, thông báo, tư liệu, bài gửi; được công bố/xóa
#   contributor - cộng tác viên: nhập/sửa mục lục và toàn văn của số CHƯA công bố; không công bố, không xóa
ROLES = ("admin", "editor", "contributor")


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
submit_limiter = Limiter(5, 3600, "Bạn gửi bài quá nhiều lần, vui lòng thử lại sau")
track_limiter = Limiter(20, 900, "Tra cứu quá nhiều lần, vui lòng thử lại sau")


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "?"


def check_login_allowed(request: Request) -> str:
    ip = client_ip(request)
    login_limiter.check(ip)
    return ip


def record_fail(ip: str) -> None:
    login_limiter.record(ip)


def reset_fails() -> None:
    for lim in (login_limiter, submit_limiter, track_limiter):
        lim.reset()
