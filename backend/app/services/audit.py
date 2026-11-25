"""Nhật ký hoạt động.

AuditMiddleware ghi một dòng audit_logs cho mọi request ghi dữ liệu (POST/PUT/PATCH/DELETE) thành công dưới
/api/v1/admin, cùng các lần đăng nhập (kể cả thất bại). Người thực hiện lấy từ JWT; tên đối tượng (summary) do
handler bổ sung bằng note(request, ...) nếu có. Lỗi khi ghi nhật ký không bao giờ làm hỏng request chính.
"""
import logging

import jwt
from starlette.concurrency import run_in_threadpool
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from ..config import settings
from ..db import SessionLocal
from ..models import AuditLog, User
from ..security import client_ip

log = logging.getLogger(__name__)
PREFIX = "/api/v1/admin/"
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SKIP_SUFFIXES = ("/toc/preview", "/preview-link")  # POST nhưng chỉ đọc

ENTITY_LABELS = {
    "auth": "Tài khoản", "users": "Người dùng", "issues": "Số đặc san", "toc-entries": "Mục lục", "fields": "Chuyên mục",
    "submissions": "Bài gửi", "activities": "Hoạt động", "activity-types": "Loại hoạt động",
    "documents": "Tư liệu", "pages": "Trang nội dung", "settings": "Cấu hình site", "subscribers": "Đăng ký email",
    "upload": "Tệp tải lên", "media": "Kho ảnh", "banners": "Banner", "outbox": "Hộp thư đi",
    "backups": "Sao lưu", "pdf-articles": "Bài từ PDF", "posts": "Bài viết", "submissions_public": "Bài gửi (tác giả)",
}
ACTION_LABELS = {
    "create": "Thêm", "update": "Sửa", "delete": "Xóa", "login": "Đăng nhập", "login_failed": "Đăng nhập thất bại",
    "change_password": "Đổi mật khẩu", "upload": "Tải tệp lên", "merge": "Gộp chuyên mục", "import": "Nhập mục lục từ PDF", "extract": "Lấy bài từ PDF",
    "decision": "Quyết định biên tập", "reviews": "Phân công phản biện", "remind": "Nhắc hạn phản biện",
    "link": "Tạo lại liên kết phản biện", "toc-entry": "Đưa vào mục lục",
    "forgot_password": "Yêu cầu đặt lại mật khẩu", "reset_password": "Đặt lại mật khẩu", "register": "Tự đăng ký tài khoản",
    "resend": "Gửi lại thư", "test": "Gửi thư thử",
    "run": "Sao lưu ngay", "download": "Tải bản sao lưu", "download-link": "Tạo liên kết tải bản sao lưu", "malware": "Chặn tệp có mã độc",
}


def note(request: Request, summary: str | None = None, **extra) -> None:
    """Handler gọi để bổ sung mô tả cho dòng nhật ký của request hiện tại."""
    cur = getattr(request.state, "audit", None) or {}
    if summary is not None:
        cur["summary"] = summary
    cur.update(extra)
    request.state.audit = cur


def display_name(obj) -> str:
    for attr in ("title", "name", "label", "key", "email"):
        v = getattr(obj, attr, None)
        if v:
            return str(v)
    return ""


def classify(method: str, path: str, status: int) -> tuple[str, str, str | None]:
    """(action, entity, entity_id) từ method + đường dẫn API admin."""
    segs = [s for s in path[len(PREFIX):].split("/") if s]
    entity = segs[0] if segs else ""
    if entity == "auth":
        sub = segs[1] if len(segs) > 1 else ""
        if sub == "login":
            return ("login" if status < 400 else "login_failed"), entity, None
        return sub.replace("-", "_") or "auth", entity, None
    entity_id = segs[1] if len(segs) > 1 and segs[1].isdigit() else None
    if entity == "upload":
        return "upload", entity, None
    if len(segs) == 1:
        return ("create" if method == "POST" else method.lower()), entity, None
    last = segs[-1]
    if method in ("PUT", "PATCH") and (last.isdigit() or len(segs) == 2):
        return "update", entity, entity_id
    if method == "DELETE":
        return "delete", entity, entity_id
    return last, entity, entity_id


def _user_id_from(request: Request) -> int | None:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    try:
        return int(jwt.decode(auth[7:], settings.jwt_secret, algorithms=["HS256"])["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def _write(row: dict) -> None:
    with SessionLocal() as db:
        if row["user_id"] and not row["user_email"]:
            u = db.get(User, row["user_id"])
            row["user_email"] = u.email if u else ""
        db.add(AuditLog(**row))
        db.commit()


def record(request: Request, action: str, entity: str, summary: str, status: int = 200, user_id: int | None = None) -> None:
    """Ghi một dòng nhật ký ngay (dùng cho sự kiện middleware không bắt: tải xuống bằng GET, chặn tệp mã độc...)."""
    try:
        _write({
            "user_id": user_id or _user_id_from(request), "user_email": "", "action": action[:40], "entity": entity[:60],
            "entity_id": None, "summary": summary[:500], "method": request.method, "path": request.url.path[:300],
            "status_code": status, "ip": client_ip(request)[:64],
        })
    except Exception:  # noqa: BLE001
        log.exception("Không ghi được nhật ký hoạt động")


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path, method = request.url.path, request.method
        if method not in WRITE_METHODS or not path.startswith(PREFIX) or path.endswith(SKIP_SUFFIXES):
            return response
        status = response.status_code
        is_login = path == PREFIX + "auth/login"
        if status >= 400 and not (is_login and status == 401):
            return response
        try:
            action, entity, entity_id = classify(method, path, status)
            extra = getattr(request.state, "audit", None) or {}
            await run_in_threadpool(_write, {
                "user_id": extra.get("user_id") or _user_id_from(request),
                "user_email": (extra.get("email") or "")[:255],
                "action": action[:40], "entity": entity[:60], "entity_id": str(extra.get("entity_id") or entity_id or "")[:40] or None,
                "summary": (extra.get("summary") or "")[:500],
                "method": method, "path": path[:300], "status_code": status,
                "ip": client_ip(request)[:64],
            })
        except Exception:  # noqa: BLE001 - nhật ký không được làm hỏng request
            log.exception("Không ghi được nhật ký hoạt động")
        return response
