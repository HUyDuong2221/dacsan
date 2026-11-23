"""Thư báo số mới cho người đăng ký nhận tin (đã xác nhận email).

Gửi tự động khi một số đặc san được công bố lần đầu (hook after_issue ở routers/admin.py): mỗi người một thư,
có liên kết hủy đăng ký riêng. Issue.notified_at đánh dấu số đã báo, nên bỏ công bố rồi công bố lại, hay sửa
số cũ, không gửi lại. Các số đã công bố trước khi có chức năng này được đánh dấu sẵn (Alembic 0008).
"""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Issue, Subscriber, TocEntry
from . import mailer

MAX_LISTED = 8  # số bài liệt kê trong thư


def needs_notice(issue: Issue) -> bool:
    return bool(issue.published and issue.notified_at is None)


def queue_new_issue(db: Session, issue: Issue) -> list[int]:
    """Tạo thư báo cho mọi người đã xác nhận đăng ký và đánh dấu số đã báo. Trả về id thư (gửi bằng mailer.deliver)."""
    subs = db.scalars(select(Subscriber).where(Subscriber.confirmed.is_(True)).order_by(Subscriber.id)).all()
    issue.notified_at = datetime.now(timezone.utc)  # đánh dấu cả khi chưa có người đăng ký: số này đã qua lúc phát hành
    if not subs:
        return []
    entries = db.scalars(select(TocEntry).where(TocEntry.issue_id == issue.id, TocEntry.is_front.is_(False))
                         .order_by(TocEntry.sort_order, TocEntry.id)).all()
    listed = [f"• {e.title}" + (f" ({e.author})" if e.author else "") for e in entries[:MAX_LISTED]]
    if len(entries) > MAX_LISTED:
        listed.append(f"… và {len(entries) - MAX_LISTED} bài khác.")
    title = issue.title or issue.theme
    link = mailer.site_url(f"/issues/{issue.slug}")
    ids = []
    for s in subs:
        unsub = mailer.site_url(f"/huy-dang-ky?token={s.token}")
        text, page = mailer.render(db, f"Đặc san Khoa học & Phát triển {issue.label}", [
            f"{issue.label} đã phát hành: {title}." if title else f"{issue.label} đã phát hành.",
            *([issue.summary] if issue.summary else []),
            *(["Trong số này:\n" + "\n".join(listed)] if listed else []),
            "Mời bạn đọc toàn văn trực tuyến hoặc đọc bản PDF trên website Đặc san.",
        ], ("Đọc số mới", link), f"Bạn nhận thư này vì đã đăng ký nhận tin của Đặc san. Hủy đăng ký: {unsub}")
        ids.append(mailer.queue(db, s.email, f"Đặc san KH&PT Đà Nẵng: {issue.label} đã phát hành", text, "new_issue", page,
                                meta={"unsubscribe": unsub}).id)
    return ids
