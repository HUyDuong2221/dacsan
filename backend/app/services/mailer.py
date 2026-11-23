"""Gửi email qua SMTP với hộp thư đi (email_outbox).

queue() tạo thư (trong transaction của request); deliver() gửi các thư đó sau khi request trả về (FastAPI
BackgroundTasks), mở session riêng. Chưa cấu hình SMTP (SMTP_HOST, SMTP_FROM) thì thư nằm ở trạng thái
"unconfigured" để quản trị viên xem/gửi tay ở mục Hộp thư đi. Mật khẩu SMTP không bao giờ trả ra API.
"""
import html
import logging
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal
from ..models import EmailOutbox, Setting

log = logging.getLogger(__name__)
DEFAULT_SENDER = "Đặc san KH&PT Đà Nẵng"


def configured() -> bool:
    return bool(settings.smtp_host.strip() and settings.smtp_from.strip())


def site_url(path: str = "") -> str:
    return settings.site_url.rstrip("/") + path


def org_name(db: Session) -> str:
    s = db.scalars(select(Setting).where(Setting.key == "org_name")).first()
    return (s.value if s and s.value else "Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng").strip()


def render(db: Session, heading: str, paragraphs: list[str], button: tuple[str, str] | None = None,
           footer: str = "") -> tuple[str, str]:
    """(text, html) của một email đơn giản. Mọi chuỗi đều được escape khi đưa vào HTML."""
    org = org_name(db)
    text = "\n\n".join([heading, *paragraphs] + ([f"{button[0]}: {button[1]}"] if button else []) + ([footer] if footer else [])
                       + [f"--\nĐặc san Khoa học & Phát triển thành phố Đà Nẵng\n{org}"])
    e = html.escape
    btn = (f'<p style="margin:24px 0"><a href="{e(button[1], quote=True)}" style="display:inline-block;padding:12px 22px;'
           f'background:#0B4F9C;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">{e(button[0])}</a></p>'
           f'<p style="font-size:13px;color:#5A6577">Nếu nút không bấm được, mở liên kết: <br>{e(button[1])}</p>') if button else ""
    body = "".join(f'<p style="margin:0 0 14px;line-height:1.6">{e(p).replace(chr(10), "<br>")}</p>' for p in paragraphs)
    foot = f'<p style="font-size:13px;color:#5A6577;line-height:1.6">{e(footer)}</p>' if footer else ""
    page = (
        '<!doctype html><html lang="vi"><body style="margin:0;padding:24px;background:#F4F7FB;'
        'font-family:Arial,Helvetica,sans-serif;color:#1B2433">'
        '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-top:4px solid #0B4F9C;border-radius:8px;padding:28px">'
        '<div style="font-size:12px;letter-spacing:.08em;color:#0B4F9C;font-weight:700">ĐẶC SAN KHOA HỌC &amp; PHÁT TRIỂN</div>'
        f'<h1 style="font-size:21px;margin:10px 0 18px;color:#0B2F5E">{e(heading)}</h1>{body}{btn}{foot}'
        f'<hr style="border:0;border-top:1px solid #DCE5F0;margin:24px 0 12px"><p style="font-size:12px;color:#5A6577">{e(org)}</p>'
        "</div></body></html>"
    )
    return text, page


def queue(db: Session, to: str, subject: str, text: str, kind: str, html_body: str | None = None,
          meta: dict | None = None) -> EmailOutbox:
    subject = " ".join(subject.split())  # không cho xuống dòng trong tiêu đề (chèn header)
    row = EmailOutbox(to_email=to[:255], subject=subject[:300], body_text=text, body_html=html_body, kind=kind,
                      status="pending" if configured() else "unconfigured", meta=meta, attempts=0)
    db.add(row)
    db.flush()
    return row


def _connect() -> smtplib.SMTP:
    sec = settings.smtp_security.lower()
    ctx = ssl.create_default_context()
    if sec == "ssl":
        conn: smtplib.SMTP = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20, context=ctx)
    else:
        conn = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20)
        if sec == "starttls":
            conn.starttls(context=ctx)
    if settings.smtp_user:
        conn.login(settings.smtp_user, settings.smtp_password)
    return conn


def _message(r: EmailOutbox) -> EmailMessage:
    m = EmailMessage()
    m["From"] = formataddr((DEFAULT_SENDER, settings.smtp_from))
    m["To"] = r.to_email
    m["Subject"] = r.subject
    m["Message-ID"] = make_msgid(domain=settings.smtp_from.split("@")[-1] or None)
    unsub = (r.meta or {}).get("unsubscribe")
    if unsub:
        m["List-Unsubscribe"] = f"<{unsub}>"
    m.set_content(r.body_text)
    if r.body_html:
        m.add_alternative(r.body_html, subtype="html")
    return m


def deliver(ids: list[int]) -> None:
    """Gửi các thư đang chờ trong danh sách ids (gọi nền sau khi request đã commit)."""
    if not ids or not configured():
        return
    with SessionLocal() as db:
        rows = db.scalars(select(EmailOutbox).where(EmailOutbox.id.in_(ids), EmailOutbox.status == "pending")).all()
        if not rows:
            return
        try:
            conn = _connect()
        except Exception as e:  # noqa: BLE001 - lỗi kết nối: đánh dấu cả lô
            for r in rows:
                r.status, r.error, r.attempts = "failed", f"Không kết nối được máy chủ SMTP: {e}"[:500], (r.attempts or 0) + 1
            db.commit()
            log.warning("SMTP connect failed: %s", e)
            return
        try:
            for r in rows:
                r.attempts = (r.attempts or 0) + 1
                try:
                    conn.send_message(_message(r))
                    r.status, r.error, r.sent_at = "sent", None, datetime.now(timezone.utc)
                except Exception as e:  # noqa: BLE001
                    r.status, r.error = "failed", str(e)[:500]
                db.commit()
        finally:
            try:
                conn.quit()
            except Exception:  # noqa: BLE001
                pass
