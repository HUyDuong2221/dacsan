"""Các mục quản trị nội dung dùng factory CRUD (routers/crud.py), cùng vài thao tác riêng của chúng:
gộp chuyên mục, danh sách đăng ký nhận tin, liên kết xem trước số chưa công bố."""
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (BANNER_POSITIONS, Activity, ActivityType, Banner, Field, Issue, Page, Post, Setting,
                      Spotlight, Subscriber, TocEntry, User)
from ..security import ADMIN, EDIT, STAFF, make_preview_token, require_roles
from ..services import audit, mailer, newsletter
from .crud import crud
from .media import pdf_page_count

router = APIRouter()


def prepare_issue(data: dict, existing: Issue | None) -> None:
    """Nhãn ("Số 17 (6-2026)") và năm tự sinh từ Số đặc san + Ngày đăng, không nhập tay.
    Số trang để trống thì tự đếm từ file PDF."""
    if data.get("page_count") in (None, "") and ("page_count" in data or "pdf_url" in data or existing is None):
        pdf = data.get("pdf_url", existing.pdf_url if existing else None)
        n_pages = pdf_page_count(pdf)
        if n_pages:
            data["page_count"] = n_pages
    if "number" not in data and "published_at" not in data:
        return
    number = data.get("number", existing.number if existing else None)
    raw = data.get("published_at", existing.published_at if existing else None)
    try:
        n = int(number)
        d = raw if isinstance(raw, date) else (date.fromisoformat(str(raw)[:10]) if raw else None)
    except (TypeError, ValueError):
        return  # để coerce() báo lỗi 422 đúng trường
    data["label"] = f"Số {n:02d}" + (f" ({d.month}-{d.year})" if d else "")
    data["year"] = d.year if d else (existing.year if existing else date.today().year)


def after_issue(db: Session, issue: Issue, request: Request, bg: BackgroundTasks) -> None:
    """Công bố số lần đầu: tự gửi thư báo số mới tới người đăng ký nhận tin (services/newsletter.py)."""
    if not newsletter.needs_notice(issue):
        return
    ids = newsletter.queue_new_issue(db, issue)
    db.commit()
    audit.note(request, f"{issue.label} · công bố, gửi thư báo số mới tới {len(ids)} người đăng ký")
    if ids:
        bg.add_task(mailer.deliver, ids)


def guard_entry(user: User, db: Session, data: dict, obj: TocEntry | None) -> None:
    """Cộng tác viên chỉ được nhập/sửa mục lục của số CHƯA công bố."""
    if user.role != "contributor":
        return
    ids = {obj.issue_id} if obj else set()
    try:
        if data.get("issue_id") not in (None, ""):
            ids.add(int(data["issue_id"]))
    except (TypeError, ValueError):
        pass
    for i in ids:
        issue = db.get(Issue, i)
        if issue and issue.published:
            raise HTTPException(403, "Số này đã công bố, chỉ biên tập viên được sửa")


def prepare_post(data: dict, existing: Post | None) -> None:
    """Tiêu đề bắt buộc; bài mới chưa có ngày đăng thì lấy ngày hôm nay."""
    if existing is None or "title" in data:
        data["title"] = " ".join(str(data.get("title") or "").split())
        if not data["title"]:
            raise HTTPException(422, "Thiếu trường: title")
    if existing is None and not data.get("published_at"):
        data["published_at"] = date.today().isoformat()


SPOT_REFS = {"issue_id": Issue, "activity_id": Activity, "page_id": Page, "post_id": Post}


def guard_spotlight(user: User, db: Session, data: dict, existing: Spotlight | None) -> None:
    """Mỗi dòng Tiêu điểm trỏ tới đúng một nội dung (số đặc san, hoạt động, trang nội dung hoặc bài viết) và nội dung đó phải tồn tại."""
    refs: dict[str, int | None] = {}
    for k in SPOT_REFS:
        v = data[k] if k in data else (getattr(existing, k) if existing else None)
        try:
            refs[k] = int(v) if v not in (None, "") else None
        except (TypeError, ValueError):
            raise HTTPException(422, "Nội dung được chọn không hợp lệ")
    chosen = [k for k, v in refs.items() if v is not None]
    if existing is None:  # mục mới luôn lên đầu danh sách (trang chủ lấy 10 mục đầu, tức 10 mục thêm gần nhất)
        data["sort_order"] = (db.scalar(select(func.min(Spotlight.sort_order))) or 0) - 1 if db.scalar(select(func.count(Spotlight.id))) else 0
    if len(chosen) != 1:
        raise HTTPException(422, "Hãy chọn đúng một nội dung: số đặc san, hoạt động, trang nội dung hoặc bài viết")
    if not db.get(SPOT_REFS[chosen[0]], refs[chosen[0]]):
        raise HTTPException(422, "Nội dung được chọn không còn tồn tại")
    data.update(refs)
    for k in ("title", "excerpt"):
        if k in data:
            data[k] = " ".join(str(data[k] or "").split())
    if "image_url" in data:
        data["image_url"] = (data["image_url"] or "").strip() or None


def prepare_banner(data: dict, existing: Banner | None) -> None:
    """Vị trí phải nằm trong BANNER_POSITIONS; liên kết (nếu có) là đường dẫn trong site hoặc http(s)."""
    if existing is None:
        data.setdefault("position", "top")
    pos = data.get("position")
    if pos is not None and pos not in BANNER_POSITIONS:
        raise HTTPException(422, "Vị trí banner không hợp lệ")
    if "link" in data:
        link = (data.get("link") or "").strip()
        if link and not (link.startswith("/") and not link.startswith("//") or link.startswith(("http://", "https://"))):
            raise HTTPException(422, "Liên kết phải bắt đầu bằng / hoặc http(s)://")
        data["link"] = link or None
    if "image_url" in data and not (data.get("image_url") or "").strip():
        raise HTTPException(422, "Vui lòng chọn ảnh banner")


router.include_router(crud(Issue, "/issues", [Issue.number.desc()], slug_from="label", prepare=prepare_issue,
                           after=after_issue))
router.include_router(crud(TocEntry, "/toc-entries", [TocEntry.issue_id.desc(), TocEntry.sort_order, TocEntry.id], slug_from="title",
                           write=STAFF, guard=guard_entry))
router.include_router(crud(Post, "/posts", [Post.published_at.desc().nullslast(), Post.id.desc()], slug_from="title",
                           read=EDIT, prepare=prepare_post))
router.include_router(crud(Field, "/fields", [Field.sort_order, Field.id]))
router.include_router(crud(Activity, "/activities", [Activity.event_date.desc().nullslast()], read=EDIT))
router.include_router(crud(ActivityType, "/activity-types", [ActivityType.sort_order, ActivityType.id], read=EDIT))
router.include_router(crud(Setting, "/settings", [Setting.key], read=ADMIN, write=ADMIN, remove=ADMIN))
router.include_router(crud(Page, "/pages", [Page.sort_order, Page.id], slug_from="title", read=EDIT))
router.include_router(crud(Spotlight, "/spotlights", [Spotlight.sort_order, Spotlight.id], read=EDIT, guard=guard_spotlight))
router.include_router(crud(Banner, "/banners", [Banner.position, Banner.sort_order, Banner.id], prepare=prepare_banner,
                           read=ADMIN, write=ADMIN, remove=ADMIN))


@router.get("/subscribers", dependencies=[Depends(require_roles(*ADMIN))])
def subscribers(db: Session = Depends(get_db)):
    # không trả token (link xác nhận/hủy đăng ký riêng của từng người)
    return [{"id": s.id, "email": s.email, "confirmed": bool(s.confirmed), "created_at": s.created_at.isoformat() if s.created_at else None}
            for s in db.scalars(select(Subscriber).order_by(Subscriber.id.desc()))]


@router.delete("/subscribers/{sid}", status_code=204, dependencies=[Depends(require_roles(*ADMIN))])
def delete_subscriber(sid: int, request: Request, db: Session = Depends(get_db)):
    s = db.get(Subscriber, sid)
    if s:
        audit.note(request, s.email)
        db.delete(s)
        db.commit()


class MergeIn(BaseModel):
    target_id: int


@router.post("/fields/{field_id}/merge", dependencies=[Depends(require_roles(*EDIT))])
def merge_field(field_id: int, body: MergeIn, request: Request, db: Session = Depends(get_db)):
    """Gộp chuyên mục vào chuyên mục khác: chuyển mọi dòng mục lục sang chuyên mục đích rồi xóa chuyên mục nguồn."""
    src, dst = db.get(Field, field_id), db.get(Field, body.target_id)
    if not src or not dst:
        raise HTTPException(404, "Không tìm thấy chuyên mục")
    if src.id == dst.id:
        raise HTTPException(422, "Chọn một chuyên mục khác để gộp")
    moved = db.query(TocEntry).filter(TocEntry.field_id == src.id).update({TocEntry.field_id: dst.id})
    audit.note(request, f"{src.name} → {dst.name} ({moved} dòng mục lục)")
    db.delete(src)
    db.commit()
    return {"moved": moved}


# ---------- xem trước số chưa công bố ----------
@router.post("/issues/{issue_id}/preview-link", dependencies=[Depends(require_roles(*STAFF))])
def preview_link(issue_id: int, db: Session = Depends(get_db)):
    """Liên kết xem trước số (kể cả chưa công bố) như người đọc thấy; mở qua /xem-truoc của frontend, hết hạn sau 2 giờ."""
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(404, "Không tìm thấy số đặc san")
    token = make_preview_token(issue.id)
    return {"url": f"/xem-truoc?token={token}&slug={issue.slug}", "published": issue.published}
