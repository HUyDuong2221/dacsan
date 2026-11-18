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


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except ValueError:
        return False


def make_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_hours)
    return jwt.encode({"sub": str(user.id), "role": user.role, "exp": exp}, settings.jwt_secret, "HS256")


def require_admin(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    if not cred:
        raise HTTPException(401, "Chưa đăng nhập")
    try:
        data = jwt.decode(cred.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Phiên đăng nhập không hợp lệ")
    user = db.get(User, int(data["sub"]))
    if not user:
        raise HTTPException(401, "Tài khoản không tồn tại")
    return user


# Giới hạn đăng nhập sai: 8 lần / 15 phút / IP (bộ nhớ tiến trình; đủ cho 1 instance).
_fails: dict[str, list[float]] = defaultdict(list)
WINDOW, LIMIT = 900, 8


def check_login_allowed(request: Request) -> str:
    ip = request.client.host if request.client else "?"
    now = time.time()
    _fails[ip] = [t for t in _fails[ip] if now - t < WINDOW]
    if len(_fails[ip]) >= LIMIT:
        raise HTTPException(429, "Đăng nhập sai quá nhiều lần, thử lại sau ít phút")
    return ip


def record_fail(ip: str) -> None:
    _fails[ip].append(time.time())


def reset_fails() -> None:
    _fails.clear()
