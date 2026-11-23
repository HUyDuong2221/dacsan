"""Sao lưu (chỉ quản trị viên).

Container `backup` (thư mục backup/ ở gốc dự án) tạo bản sao lưu vào volume backups (mount ở BACKUP_DIR):
mỗi bản là một tệp dacsan-YYYYmmdd-HHMMSS.tar.gz gồm db.dump (pg_dump -Fc), media/, private/; trạng thái lần chạy
gần nhất ở status.json. Backend chỉ đọc danh sách, ghi tệp yêu cầu ".request" để container chạy ngay, và cho tải về
bằng link ký ngắn hạn (trình duyệt tải thẳng, không đọc cả tệp vào bộ nhớ). Bản sao lưu chứa toàn bộ dữ liệu
(kể cả mật khẩu đã băm và bản thảo không công khai): mọi lần tạo link tải đều ghi nhật ký.
"""
import json
import os
import re
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse

from ..services import audit, scanner
from ..config import settings
from ..models import User
from ..security import require_roles

router = APIRouter(prefix="/backups")
NAME_RE = re.compile(r"^dacsan-\d{8}-\d{6}\.tar\.gz$")
LINK_MINUTES = 5
STALE_HOURS = 30  # quá lâu không có bản sao lưu thành công: cảnh báo


def _dir() -> str:
    return settings.backup_dir


def _status() -> dict | None:
    try:
        with open(os.path.join(_dir(), "status.json"), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _files() -> list[dict]:
    out = []
    try:
        names = os.listdir(_dir())
    except OSError:
        return out
    for n in names:
        if NAME_RE.match(n):
            st = os.stat(os.path.join(_dir(), n))
            out.append({"name": n, "size": st.st_size, "created_at": datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat()})
    out.sort(key=lambda x: x["name"], reverse=True)
    return out


@router.get("", dependencies=[Depends(require_roles("admin"))])
def list_backups():
    files = _files()
    enabled = os.path.isdir(_dir())
    newest = files[0]["created_at"] if files else None
    stale = enabled and (not newest or datetime.now(timezone.utc) - datetime.fromisoformat(newest) > timedelta(hours=STALE_HOURS))
    return {
        "enabled": enabled, "status": _status(), "files": files, "stale": stale,
        "requested": os.path.exists(os.path.join(_dir(), ".request")),
        "scanner": {"enabled": scanner.enabled(), "online": scanner.ping() if scanner.enabled() else False,
                    "fail_open": settings.clamav_fail_open},
    }


@router.post("/run", dependencies=[Depends(require_roles("admin"))])
def run_backup(request: Request):
    if not os.path.isdir(_dir()):
        raise HTTPException(409, "Chưa gắn thư mục sao lưu (volume backups) cho backend")
    with open(os.path.join(_dir(), ".request"), "w", encoding="utf-8") as f:
        f.write(datetime.now(timezone.utc).isoformat())
    audit.note(request, "Yêu cầu sao lưu ngay")
    return {"requested": True}


@router.post("/{name}/download-link")
def download_link(name: str, request: Request, user: User = Depends(require_roles("admin"))):
    if not NAME_RE.match(name) or not os.path.isfile(os.path.join(_dir(), name)):
        raise HTTPException(404, "Không tìm thấy bản sao lưu")
    exp = datetime.now(timezone.utc) + timedelta(minutes=LINK_MINUTES)
    tok = jwt.encode({"purpose": "backup", "name": name, "uid": user.id, "exp": exp}, settings.jwt_secret, "HS256")
    audit.note(request, f"Tạo liên kết tải {name}")
    return {"url": f"/api/v1/admin/backups/download?token={tok}", "expires_in": LINK_MINUTES * 60}


@router.get("/download")
def download(token: str, request: Request):
    """Tải bản sao lưu bằng liên kết ký (không cần header đăng nhập để trình duyệt tải thẳng)."""
    try:
        data = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(403, "Liên kết tải đã hết hạn hoặc không hợp lệ, hãy tạo lại trong trang quản trị")
    name = data.get("name", "")
    if data.get("purpose") != "backup" or not NAME_RE.match(name):
        raise HTTPException(403, "Liên kết tải không hợp lệ")
    path = os.path.join(_dir(), name)
    if not os.path.isfile(path):
        raise HTTPException(404, "Không tìm thấy bản sao lưu")
    audit.record(request, "download", "backups", name, user_id=data.get("uid"))
    return FileResponse(path, filename=name, media_type="application/gzip")
