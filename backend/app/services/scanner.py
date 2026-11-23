"""Quét mã độc tệp tải lên bằng ClamAV (clamd qua TCP).

Dùng lệnh SCAN <đường dẫn>: container clamav mount cùng volume media/private ở cùng đường dẫn (chỉ đọc), nên
clamd đọc thẳng tệp trên đĩa, không bị giới hạn StreamMaxLength (25MB) như INSTREAM.
Chưa đặt CLAMAV_HOST thì không quét. Máy quét lỗi: mặc định từ chối tệp (CLAMAV_FAIL_OPEN=false).
"""
import logging
import os
import socket

from fastapi import HTTPException, Request

from . import audit
from ..config import settings

log = logging.getLogger(__name__)


class ScanUnavailable(Exception):
    pass


def enabled() -> bool:
    return bool(settings.clamav_host.strip())


def _command(cmd: bytes, timeout: float = 120) -> str:
    with socket.create_connection((settings.clamav_host, settings.clamav_port), timeout=timeout) as s:
        s.sendall(b"z" + cmd + b"\0")
        buf = b""
        while not buf.endswith(b"\0"):
            chunk = s.recv(4096)
            if not chunk:
                break
            buf += chunk
    return buf.rstrip(b"\0").decode("utf-8", "replace").strip()


def ping() -> bool:
    try:
        return _command(b"PING", timeout=5) == "PONG"
    except OSError:
        return False


def scan(path: str) -> str | None:
    """Tên mã độc nếu phát hiện, None nếu sạch. ScanUnavailable nếu không quét được."""
    try:
        reply = _command(b"SCAN " + os.path.abspath(path).encode())
    except OSError as e:
        raise ScanUnavailable(f"Không kết nối được máy quét: {e}") from e
    if reply.endswith(" OK"):
        return None
    if reply.endswith(" FOUND"):
        return reply.rsplit(": ", 1)[-1][: -len(" FOUND")].strip() or "không rõ"
    raise ScanUnavailable(reply[:300] or "Máy quét không trả lời")


def check_file(path: str, request: Request, display_name: str, entity: str = "upload") -> None:
    """Quét tệp vừa lưu. Có mã độc: xóa tệp, ghi nhật ký, trả 422. Máy quét lỗi: xóa tệp, trả 503 (trừ khi fail-open)."""
    if not enabled():
        return
    try:
        virus = scan(path)
    except ScanUnavailable as e:
        if settings.clamav_fail_open:
            log.warning("Bỏ qua quét mã độc (fail-open): %s", e)
            return
        _remove(path)
        log.error("Máy quét mã độc không hoạt động: %s", e)
        raise HTTPException(503, "Hệ thống quét mã độc đang khởi động hoặc tạm thời không hoạt động. Vui lòng thử lại sau ít phút.")
    if virus:
        _remove(path)
        audit.record(request, "malware", entity, f"{display_name[:200]}: {virus}", status=422)
        raise HTTPException(422, f"Tệp bị chặn vì phát hiện mã độc ({virus}). Hãy quét lại máy tính và gửi tệp khác.")


def _remove(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass
