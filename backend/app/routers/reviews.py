"""Phản biện bài gửi.

Ban biên tập (admin/editor) phân công phản biện viên, đặt hạn, nhắc hạn. Phản biện viên là người ngoài, không có
tài khoản: họ vào trang /phan-bien/<token> để nhận/từ chối, tải bản thảo và nộp phiếu đánh giá (khuyến nghị + nhận xét,
không chấm điểm). DB chỉ lưu sha256 của token; token gốc chỉ trả về một lần khi phân công (hoặc khi tạo lại link).
Phản biện viên không thấy tên/email tác giả (phản biện kín).
"""
import hashlib
import os
import secrets
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import (REVIEW_RECOMMENDATIONS, REVIEW_STATUSES, SUBMISSION_STATUSES, Review, Submission, User)
from ..security import current_user, require_roles
from .submissions import EMAIL_RE, _dt, add_history

admin_router = APIRouter(prefix="/submissions", dependencies=[Depends(require_roles("admin", "editor"))])
public_router = APIRouter(prefix="/reviews")

ASSIGNABLE = {"new", "reviewing", "in_review"}  # trạng thái bài còn nhận phân công phản biện
OPEN = {"invited", "accepted", "overdue"}  # lượt phản biện chưa kết thúc
CLOSED_SUBMISSION = {"accepted", "rejected"}  # bài đã có quyết định cuối: không nhận đánh giá nữa


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _new_token() -> tuple[str, str]:
    t = secrets.token_urlsafe(32)
    return t, _hash(t)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _fmt(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def refresh_overdue(r: Review) -> None:
    if r.status in ("invited", "accepted") and r.due_date < date.today():
        r.status = "overdue"


def review_dict(r: Review) -> dict:
    return {
        "id": r.id, "submission_id": r.submission_id, "reviewer_name": r.reviewer_name, "reviewer_email": r.reviewer_email,
        "invited_at": _dt(r.invited_at), "due_date": _dt(r.due_date),
        "status": r.status, "status_label": REVIEW_STATUSES.get(r.status, r.status),
        "recommendation": r.recommendation, "recommendation_label": REVIEW_RECOMMENDATIONS.get(r.recommendation or ""),
        "form_data": r.form_data or {}, "reminder_count": r.reminder_count or 0,
        "last_reminded_at": _dt(r.last_reminded_at), "submitted_at": _dt(r.submitted_at),
    }


def _with_link(r: Review, token: str) -> dict:
    return {**review_dict(r), "token": token, "review_url": f"/phan-bien/{token}"}


# ---------- ban biên tập ----------
def _sub(db: Session, sid: int) -> Submission:
    s = db.get(Submission, sid)
    if not s:
        raise HTTPException(404, "Không tìm thấy bài gửi")
    return s


def _review(db: Session, sid: int, rid: int) -> Review:
    r = db.get(Review, rid)
    if not r or r.submission_id != sid:
        raise HTTPException(404, "Không tìm thấy lượt phản biện")
    return r


@admin_router.get("/{sid}/reviews")
def list_reviews(sid: int, db: Session = Depends(get_db)):
    s = _sub(db, sid)
    for r in s.reviews:
        refresh_overdue(r)
    db.commit()
    return [review_dict(r) for r in s.reviews]


class AssignIn(BaseModel):
    reviewer_name: str
    reviewer_email: str
    due_date: date


@admin_router.post("/{sid}/reviews", status_code=201)
def assign_reviewer(sid: int, body: AssignIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Phân công phản biện. Bài đang Mới nhận/Đang xét duyệt chuyển sang Phân công phản biện (ghi lịch sử)."""
    s = _sub(db, sid)
    name, email = body.reviewer_name.strip(), body.reviewer_email.strip().lower()
    if not 2 <= len(name) <= 200:
        raise HTTPException(422, "Vui lòng nhập họ tên phản biện viên")
    if not EMAIL_RE.match(email) or len(email) > 255:
        raise HTTPException(422, "Email phản biện viên không hợp lệ")
    if body.due_date < date.today():
        raise HTTPException(422, "Hạn phản biện phải từ hôm nay trở đi")
    if s.status not in ASSIGNABLE:
        raise HTTPException(409, f"Bài đang ở trạng thái “{SUBMISSION_STATUSES.get(s.status, s.status)}”, không phân công phản biện được")
    if any(r.reviewer_email == email and r.status in OPEN for r in s.reviews):
        raise HTTPException(409, "Phản biện viên này đang có lượt phản biện chưa xong cho bài này")
    token, h = _new_token()
    r = Review(reviewer_name=name, reviewer_email=email, due_date=body.due_date, status="invited",
               token_hash=h, reminder_count=0)
    s.reviews.append(r)
    note = f"Phân công phản biện: {name} ({email}), hạn {_fmt(body.due_date)}"
    add_history(s, "in_review" if s.status in ("new", "reviewing") else s.status, note, user)
    # TODO(email): gửi thư mời phản biện kèm link /phan-bien/<token> tới reviewer_email.
    # Hiện chưa gửi email thật; ban biên tập sao chép link trả về để gửi thủ công.
    db.commit()
    return _with_link(r, token)


@admin_router.post("/{sid}/reviews/{rid}/remind")
def remind_reviewer(sid: int, rid: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Nhắc hạn: chỉ ghi nhận lần nhắc (số lần, thời điểm, lịch sử)."""
    s, r = _sub(db, sid), _review(db, sid, rid)
    refresh_overdue(r)
    if r.status not in OPEN:
        raise HTTPException(409, f"Lượt phản biện đã “{REVIEW_STATUSES.get(r.status, r.status)}”, không cần nhắc")
    r.reminder_count = (r.reminder_count or 0) + 1
    r.last_reminded_at = _now()
    add_history(s, s.status, f"Nhắc hạn phản biện lần {r.reminder_count}: {r.reviewer_name}, hạn {_fmt(r.due_date)}", user)
    # TODO(email): gửi thư nhắc hạn tới r.reviewer_email. Hiện chỉ ghi nhận, chưa gửi email thật.
    db.commit()
    return review_dict(r)


@admin_router.post("/{sid}/reviews/{rid}/link")
def regenerate_link(sid: int, rid: int, db: Session = Depends(get_db)):
    """Tạo liên kết mới (liên kết cũ hết hiệu lực), dùng khi ban biên tập làm mất liên kết lúc phân công."""
    r = _review(db, sid, rid)
    if r.status not in OPEN:
        raise HTTPException(409, "Lượt phản biện đã kết thúc, không tạo lại liên kết")
    token, r.token_hash = _new_token()
    db.commit()
    return _with_link(r, token)


# ---------- phản biện viên (công khai, xác thực bằng token) ----------
def _by_token(db: Session, token: str) -> Review:
    r = db.scalars(select(Review).where(Review.token_hash == _hash(token))).first() if 20 <= len(token) <= 100 else None
    if not r:
        raise HTTPException(404, "Liên kết phản biện không hợp lệ hoặc đã được thay")
    refresh_overdue(r)
    return r


def public_dict(r: Review) -> dict:
    s = r.submission
    return {
        "reviewer_name": r.reviewer_name, "due_date": _dt(r.due_date), "invited_at": _dt(r.invited_at),
        "status": r.status, "status_label": REVIEW_STATUSES.get(r.status, r.status),
        "recommendation": r.recommendation, "form_data": r.form_data or {}, "submitted_at": _dt(r.submitted_at),
        "submission": {"title": s.title, "abstract": s.abstract, "field_name": s.field_name, "file_name": s.file_name},
        "closed": s.status in CLOSED_SUBMISSION,
        "recommendations": [{"value": k, "label": v} for k, v in REVIEW_RECOMMENDATIONS.items()],
    }


@public_router.get("/{token}")
def get_review(token: str, db: Session = Depends(get_db)):
    r = _by_token(db, token)
    db.commit()
    return public_dict(r)


class RespondIn(BaseModel):
    accept: bool


@public_router.post("/{token}/respond")
def respond(token: str, body: RespondIn, db: Session = Depends(get_db)):
    r = _by_token(db, token)
    if r.status not in OPEN:
        raise HTTPException(409, "Lượt phản biện này đã kết thúc")
    if body.accept:
        r.status = "accepted"
        refresh_overdue(r)
    else:
        r.status = "declined"
        add_history(r.submission, r.submission.status, f"{r.reviewer_name} từ chối phản biện")
    db.commit()
    return public_dict(r)


class ReviewIn(BaseModel):
    recommendation: str
    comments_author: str
    comments_editor: str = ""


@public_router.post("/{token}/submit")
def submit_review(token: str, body: ReviewIn, db: Session = Depends(get_db)):
    r = _by_token(db, token)
    if r.status not in OPEN:
        raise HTTPException(409, "Lượt phản biện này đã kết thúc, không nộp được nữa")
    if r.submission.status in CLOSED_SUBMISSION:
        raise HTTPException(409, "Bài đã có quyết định cuối cùng, ban biên tập không nhận thêm đánh giá")
    if body.recommendation not in REVIEW_RECOMMENDATIONS:
        raise HTTPException(422, "Vui lòng chọn khuyến nghị")
    ca, ce = body.comments_author.strip(), body.comments_editor.strip()
    if len(ca) < 10:
        raise HTTPException(422, "Nhận xét gửi tác giả cần ít nhất 10 ký tự")
    if len(ca) > 20000 or len(ce) > 20000:
        raise HTTPException(422, "Nhận xét quá dài (tối đa 20.000 ký tự)")
    r.recommendation = body.recommendation
    r.form_data = {"comments_author": ca, "comments_editor": ce}
    r.status, r.submitted_at = "submitted", _now()
    s = r.submission
    add_history(s, s.status, f"{r.reviewer_name} đã nộp đánh giá: {REVIEW_RECOMMENDATIONS[r.recommendation]}")
    db.commit()
    return public_dict(r)


@public_router.get("/{token}/file")
def review_file(token: str, db: Session = Depends(get_db)):
    r = _by_token(db, token)
    if r.status == "declined":
        raise HTTPException(403, "Bạn đã từ chối phản biện bài này")
    s = r.submission
    path = os.path.join(settings.private_dir, os.path.basename(s.file_path))
    if not os.path.isfile(path):
        raise HTTPException(404, "Không tìm thấy bản thảo")
    # tên tệp tải về không lộ tên gốc (có thể chứa tên tác giả) cũng như mã tra cứu của tác giả
    return FileResponse(path, filename=f"ban-thao-phan-bien-{r.id}{os.path.splitext(s.file_name)[1]}")
