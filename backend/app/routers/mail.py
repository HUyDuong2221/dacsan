"""Email: hộp thư đi (admin); đăng ký / xác nhận / hủy nhận tin (công khai).
Thư báo số mới gửi tự động khi công bố số: services/newsletter.py."""
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..services import audit, mailer
from ..config import settings
from ..db import get_db
from ..models import EMAIL_KINDS, EMAIL_STATUSES, EmailOutbox, Issue, Subscriber
from ..security import client_ip, require_roles, subscribe_limiter
from .users import EMAIL_RE

admin_router = APIRouter()
public_router = APIRouter()
ADMIN = Depends(require_roles("admin"))
EDIT = Depends(require_roles("admin", "editor"))


def _dt(v):
    return v.isoformat() if v else None


def outbox_dict(r: EmailOutbox, full: bool = False) -> dict:
    d = {
        "id": r.id, "to_email": r.to_email, "subject": r.subject, "kind": r.kind, "kind_label": EMAIL_KINDS.get(r.kind, r.kind),
        "status": r.status, "status_label": EMAIL_STATUSES.get(r.status, r.status), "error": r.error, "attempts": r.attempts,
        "created_at": _dt(r.created_at), "sent_at": _dt(r.sent_at),
    }
    if full:
        d["body_text"] = r.body_text
    return d


# ---------- hộp thư đi ----------
@admin_router.get("/outbox/config", dependencies=[ADMIN])
def outbox_config():
    return {
        "configured": mailer.configured(), "host": settings.smtp_host, "port": settings.smtp_port,
        "security": settings.smtp_security, "from": settings.smtp_from, "user_set": bool(settings.smtp_user),
        "site_url": settings.site_url,
    }


@admin_router.get("/outbox", dependencies=[ADMIN])
def outbox(status: str = "", kind: str = "", q: str = "", limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    conds = []
    if status:
        conds.append(EmailOutbox.status == status)
    if kind:
        conds.append(EmailOutbox.kind == kind)
    if q.strip():
        k = f"%{q.strip()[:100]}%"
        conds.append(or_(EmailOutbox.to_email.ilike(k), EmailOutbox.subject.ilike(k)))
    limit, offset = max(1, min(limit, 200)), max(0, offset)
    total = db.scalar(select(func.count()).select_from(EmailOutbox).where(*conds)) or 0
    rows = db.scalars(select(EmailOutbox).where(*conds).order_by(EmailOutbox.id.desc()).offset(offset).limit(limit)).all()
    counts = dict(db.execute(select(EmailOutbox.status, func.count()).group_by(EmailOutbox.status)).all())
    return {"total": total, "items": [outbox_dict(r) for r in rows], "counts": counts,
            "statuses": [{"value": k, "label": v} for k, v in EMAIL_STATUSES.items()],
            "kinds": [{"value": k, "label": v} for k, v in EMAIL_KINDS.items()]}


@admin_router.get("/outbox/{oid}", dependencies=[ADMIN])
def outbox_item(oid: int, db: Session = Depends(get_db)):
    r = db.get(EmailOutbox, oid)
    if not r:
        raise HTTPException(404, "Không tìm thấy thư")
    return outbox_dict(r, full=True)


@admin_router.post("/outbox/{oid}/resend", dependencies=[ADMIN])
def outbox_resend(oid: int, request: Request, bg: BackgroundTasks, db: Session = Depends(get_db)):
    r = db.get(EmailOutbox, oid)
    if not r:
        raise HTTPException(404, "Không tìm thấy thư")
    if not mailer.configured():
        raise HTTPException(409, "Chưa cấu hình SMTP, không gửi được. Xem hướng dẫn cấu hình ở đầu trang.")
    if r.status == "sent":
        raise HTTPException(409, "Thư này đã được gửi")
    r.status, r.error = "pending", None
    audit.note(request, f"{r.to_email}: {r.subject}")
    db.commit()
    bg.add_task(mailer.deliver, [r.id])
    return outbox_dict(r)


class TestIn(BaseModel):
    to: str


@admin_router.post("/outbox/test", dependencies=[ADMIN])
def outbox_test(body: TestIn, request: Request, bg: BackgroundTasks, db: Session = Depends(get_db)):
    to = body.to.strip().lower()
    if not EMAIL_RE.match(to) or len(to) > 255:
        raise HTTPException(422, "Email không hợp lệ")
    text, page = mailer.render(db, "Thư thử", ["Đây là thư thử từ trang quản trị Đặc san. Nếu bạn nhận được thư này, cấu hình gửi email đã hoạt động."])
    r = mailer.queue(db, to, "Thư thử từ trang quản trị Đặc san KH&PT", text, "test", page)
    audit.note(request, to)
    db.commit()
    bg.add_task(mailer.deliver, [r.id])
    return outbox_dict(r)


# ---------- đăng ký nhận tin (công khai) ----------
class SubscribeIn(BaseModel):
    email: str


OK_SUBSCRIBE = {"ok": True, "message": "Đã nhận đăng ký. Vui lòng mở email và bấm liên kết xác nhận để bắt đầu nhận thư báo số mới."}


@public_router.post("/subscribe")
def subscribe(body: SubscribeIn, request: Request, bg: BackgroundTasks, db: Session = Depends(get_db)):
    """Xác nhận hai bước: gửi thư có liên kết xác nhận; chỉ người đã xác nhận mới nhận thư báo số mới."""
    ip = client_ip(request)
    subscribe_limiter.check(ip)
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email) or len(email) > 255:
        raise HTTPException(422, "Email không hợp lệ")
    subscribe_limiter.record(ip)
    s = db.scalars(select(Subscriber).where(Subscriber.email == email)).first()
    if s and s.confirmed:
        return OK_SUBSCRIBE  # không tiết lộ, không gửi lại
    if not s:
        s = Subscriber(email=email, confirmed=False)
        db.add(s)
        db.flush()
    if not s.token:
        from ..models import _unsub_token
        s.token = _unsub_token()
    text, page = mailer.render(db, "Xác nhận đăng ký nhận tin", [
        "Bạn (hoặc ai đó) vừa dùng email này để đăng ký nhận thư báo khi Đặc san Khoa học & Phát triển thành phố Đà Nẵng phát hành số mới.",
        "Bấm nút dưới đây để xác nhận.",
    ], ("Xác nhận đăng ký", mailer.site_url(f"/xac-nhan-dang-ky?token={s.token}")), "Nếu bạn không đăng ký, hãy bỏ qua email này; bạn sẽ không nhận thêm thư nào.")
    row = mailer.queue(db, email, "Xác nhận đăng ký nhận tin Đặc san KH&PT Đà Nẵng", text, "subscribe_confirm", page)
    db.commit()
    bg.add_task(mailer.deliver, [row.id])
    return OK_SUBSCRIBE


class TokenIn(BaseModel):
    token: str


def _mask(email: str) -> str:
    name, _, dom = email.partition("@")
    return (name[:2] + "•" * max(1, len(name) - 2)) + "@" + dom


def _by_token(db: Session, token: str) -> Subscriber | None:
    return db.scalars(select(Subscriber).where(Subscriber.token == token[:64])).first() if 16 <= len(token) <= 64 else None


@public_router.post("/subscribe/confirm")
def subscribe_confirm(body: TokenIn, db: Session = Depends(get_db)):
    s = _by_token(db, body.token)
    if not s:
        raise HTTPException(404, "Liên kết xác nhận không hợp lệ hoặc email đã hủy đăng ký")
    s.confirmed = True
    db.commit()
    return {"email": _mask(s.email)}


@public_router.post("/unsubscribe")
def unsubscribe(body: TokenIn, db: Session = Depends(get_db)):
    s = _by_token(db, body.token)
    if not s:
        raise HTTPException(404, "Liên kết hủy không hợp lệ hoặc email đã được hủy đăng ký trước đó")
    email = _mask(s.email)
    db.delete(s)
    db.commit()
    return {"email": email}
