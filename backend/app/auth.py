import time
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from secrets import token_urlsafe, compare_digest
import jwt
from argon2 import PasswordHasher, exceptions as argon2_exc
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core import get_db, settings
from app.models import User

router = APIRouter(prefix='/auth', tags=['Authentication'])
hasher = PasswordHasher()
DUMMY_HASH = hasher.hash("invalid account password sentinel")


class LoginPayload(BaseModel):
    email: str
    password: str


MAX_LOGIN_FAILURES = 5
LOGIN_WINDOW_SECONDS = 15 * 60
_login_failures: dict[str, deque] = defaultdict(deque)


def _login_key(request: Request, email: str) -> str:
    host = request.client.host if request.client else 'unknown'
    return f'{host}|{email}'


def _check_login_allowed(key: str):
    attempts = _login_failures[key]
    cutoff = time.monotonic() - LOGIN_WINDOW_SECONDS
    while attempts and attempts[0] < cutoff:
        attempts.popleft()
    if len(attempts) >= MAX_LOGIN_FAILURES:
        raise HTTPException(429, 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.')


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = request.cookies.get('dacsan_access')
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings().secret_key, algorithms=['HS256'])
        if payload.get('typ') != 'access':
            return None
    except jwt.PyJWTError:
        return None
    user = db.get(User, payload.get('sub'))
    return user if user and user.is_active else None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get('dacsan_access')
    if not token:
        bearer = request.headers.get('Authorization', '')
        token = bearer[7:] if bearer.startswith('Bearer ') else ''
    try:
        payload = jwt.decode(token, settings().secret_key, algorithms=['HS256'])
        user_id = payload['sub']
        if payload.get('typ') != 'access':
            raise ValueError('wrong token type')
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(401, 'Vui lòng đăng nhập.')
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(401, 'Phiên đăng nhập không hợp lệ.')
    if request.method in {'POST', 'PUT', 'PATCH', 'DELETE'} and request.cookies.get('dacsan_access'):
        csrf_cookie = request.cookies.get('dacsan_csrf', '')
        csrf_header = request.headers.get('X-CSRF-Token', '')
        if not csrf_cookie or not compare_digest(csrf_cookie, csrf_header):
            raise HTTPException(403, 'CSRF token không hợp lệ.')
    return user


def require_editor(user: User = Depends(get_current_user)) -> User:
    if user.role not in {'admin', 'editor'}:
        raise HTTPException(403, 'Không có quyền biên tập.')
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != 'admin':
        raise HTTPException(403, 'Cần quyền quản trị viên.')
    return user


@router.post('/login')
def login(body: LoginPayload, request: Request, response: Response, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    key = _login_key(request, email)
    _check_login_allowed(key)
    user = db.scalar(select(User).where(User.email == email))
    # Always verify a hash to reduce the username-existence timing signal.
    try:
        valid = hasher.verify(user.password_hash if user else DUMMY_HASH, body.password)
    except (argon2_exc.VerificationError, argon2_exc.InvalidHashError):
        valid = False
    if not user or not valid or not user.is_active:
        _login_failures[key].append(time.monotonic())
        raise HTTPException(401, 'Email hoặc mật khẩu không đúng.')
    _login_failures.pop(key, None)
    token = jwt.encode({'sub': user.id, 'typ': 'access', 'exp': datetime.now(timezone.utc)+timedelta(hours=8)}, settings().secret_key, algorithm='HS256')
    csrf = token_urlsafe(32)
    response.set_cookie('dacsan_access', token, httponly=True, secure=settings().cookie_secure, samesite='lax', max_age=8*3600, path='/')
    response.set_cookie('dacsan_csrf', csrf, httponly=False, secure=settings().cookie_secure, samesite='lax', max_age=8*3600, path='/')
    return {'id':user.id, 'email':user.email, 'role':user.role}


@router.get('/me')
def me(user: User = Depends(get_current_user)):
    return {'id':user.id, 'email':user.email, 'role':user.role}


@router.post('/logout')
def logout(response: Response, user: User = Depends(get_current_user)):
    response.delete_cookie('dacsan_access', path='/')
    response.delete_cookie('dacsan_csrf', path='/')
    return {'ok': True}
