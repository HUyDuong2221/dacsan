import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import BANNER_POSITIONS, Activity, Banner, Field, Issue, Page, Post, Setting, Spotlight, TocEntry
from ..security import preview_issue_id
from ..services.util import headings, html_add_heading_ids, html_excerpt, html_first_image

router = APIRouter()
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------- serializers ----------
def has_text(a: TocEntry) -> bool:
    return bool(a.body and a.body.strip())


def article_card(a: TocEntry) -> dict:
    return {
        "id": a.id,
        "slug": a.slug,
        "title": a.title,
        "author": a.author,
        "page_label": a.page_label,
        "field": a.field.name if a.field else None,
        "issue": {"slug": a.issue.slug, "label": a.issue.label},
        "has_fulltext": has_text(a),
    }


def issue_card(i: Issue, counts: dict[int, int]) -> dict:
    n = counts.get(i.id) or i.printed_articles or 0
    return {
        "slug": i.slug,
        "number": i.number,
        "label": i.label,
        "title": i.title,
        "published_at": i.published_at.isoformat() if i.published_at else None,
        "theme": i.theme,
        "summary": i.summary,
        "cover_url": i.cover_url,
        "pdf_url": i.pdf_url,
        "page_count": i.page_count,
        "article_count": n,
    }


def counts(db: Session) -> dict[int, int]:
    rows = db.execute(
        select(TocEntry.issue_id, func.count()).group_by(TocEntry.issue_id)
    ).all()
    return {r[0]: r[1] for r in rows}


def published_articles():
    return select(TocEntry).join(Issue).where(Issue.published.is_(True))


def visible_articles(preview_id: int | None):
    """Như published_articles, cộng thêm các bài của số đang được xem trước (token hợp lệ)."""
    if preview_id is None:
        return published_articles()
    return select(TocEntry).join(Issue).where(or_(Issue.published.is_(True), Issue.id == preview_id))


def activity_dict(a: Activity) -> dict:
    return {"id": a.id, "title": a.title, "kind": a.kind, "date": a.event_date.isoformat() if a.event_date else None, "url": a.url, "content": a.content, "attachment_url": a.attachment_url}


def sections_of(entries) -> list[str]:
    """Các phần (chuyên mục) của một số, theo thứ tự xuất hiện trong mục lục."""
    out: list[str] = []
    for e in entries:
        if e.field and e.field.name not in out:
            out.append(e.field.name)
    return out


def ordered(q):
    return q.order_by(TocEntry.sort_order, TocEntry.id)


def latest_issue(db: Session) -> Issue | None:
    return db.scalars(select(Issue).where(Issue.published.is_(True)).order_by(Issue.number.desc())).first()


def spotlight_items(db: Session, limit: int | None = None) -> list[dict]:
    """Tiêu điểm đã chọn trong quản trị, theo thứ tự sắp xếp. Bỏ qua nội dung đã xóa hoặc chưa công bố.
    Mỗi mục có kind (issue|activity|page|post), tiêu đề, tóm tắt, ảnh, đường dẫn; title/excerpt/image_url nhập tay được ưu tiên."""
    out: list[dict] = []
    rows = db.scalars(select(Spotlight).where(Spotlight.published.is_(True)).order_by(Spotlight.sort_order, Spotlight.id)).all()
    for r in rows:
        if r.issue_id:
            i = db.get(Issue, r.issue_id)
            if not i or not i.published:
                continue
            it = {"kind": "issue", "slug": i.slug, "label": i.label, "kicker": f"Đặc san {i.label.lower()}",
                  "title": i.title or i.theme, "excerpt": i.summary or "", "href": f"/issues/{i.slug}", "img": i.cover_url,
                  "date": i.published_at.isoformat() if i.published_at else None}
        elif r.activity_id:
            a = db.get(Activity, r.activity_id)
            if not a or not a.published:
                continue
            it = {"kind": "activity", "kicker": a.kind or "Hoạt động", "title": a.title, "excerpt": html_excerpt(a.content),
                  "href": f"/tin-hoat-dong/{a.id}", "img": html_first_image(a.content),
                  "date": a.event_date.isoformat() if a.event_date else None}
        elif r.page_id:
            pg = db.get(Page, r.page_id)
            if not pg or not pg.published:
                continue
            it = {"kind": "page", "kicker": "Giới thiệu", "title": pg.title, "excerpt": html_excerpt(pg.content),
                  "href": f"/trang/{pg.slug}", "img": html_first_image(pg.content), "date": None}
        elif r.post_id:
            po = db.get(Post, r.post_id)
            if not po or not po.published:
                continue
            it = {"kind": "post", "kicker": po.author or "Bài viết", "title": po.title, "excerpt": html_excerpt(po.body),
                  "href": f"/bai-viet/{po.slug}", "img": po.cover_url or html_first_image(po.body),
                  "date": po.published_at.isoformat() if po.published_at else None}
        else:
            continue
        it["key"] = f"spot-{r.id}"
        it["title"] = r.title or it["title"]
        it["excerpt"] = r.excerpt or it["excerpt"]
        it["img"] = r.image_url or it["img"]
        out.append(it)
        if limit and len(out) >= limit:
            break
    return out


def like(col, q: str):
    q = q.replace("%", r"\%").replace("_", r"\_")
    return func.unaccent(col).ilike(func.unaccent(f"%{q}%"), escape="\\")


# ---------- endpoints ----------
@router.get("/site")
def site(db: Session = Depends(get_db)):
    return {s.key: s.value for s in db.scalars(select(Setting))}


@router.get("/fields")
def fields(db: Session = Depends(get_db)):
    return [{"id": f.id, "name": f.name} for f in db.scalars(select(Field).order_by(Field.sort_order, Field.id))]


@router.get("/home")
def home(db: Session = Depends(get_db)):
    c = counts(db)
    latest = latest_issue(db)
    site_ = {s.key: s.value for s in db.scalars(select(Setting))}
    slides = []
    # Tiêu điểm: các mục chọn trong quản trị "Tiêu điểm" (số đặc san, hoạt động, trang nội dung, bài viết), tối đa 10.
    spot = spotlight_items(db, 10)
    for it in spot:
        slides.append({k: it[k] for k in ("key", "kicker", "title", "excerpt", "href", "img")} | {"kind": it["kind"]})
    featured = []
    if not spot:  # chưa chọn mục tiêu điểm nào: giữ cách hiển thị cũ (số mới nhất + bài nổi bật)
        if latest:
            slides.append({
                "key": f"issue-{latest.slug}",
                "kicker": f"Đặc san {latest.label.lower()}",
                "title": latest.title or latest.theme,
                "excerpt": site_.get("hero_intro", ""),
                "href": f"/issues/{latest.slug}",
                "img": latest.cover_url,
            })
        featured = db.scalars(
            ordered(published_articles().where(TocEntry.featured.is_(True), TocEntry.is_front.is_(False))).limit(5)
        ).unique().all()
    for a in featured:
        slides.append({
            "key": a.slug,
            "kicker": f"{a.author} · {a.page_label}",
            "title": a.title,
            "excerpt": a.hero_excerpt or a.lead or "",
            "href": f"/articles/{a.slug}",
        })
    recent = db.scalars(
        select(Issue).where(Issue.published.is_(True), Issue.id != (latest.id if latest else 0))
        .order_by(Issue.number.desc()).limit(8)
    ).all()
    in_issue = []
    if latest:
        in_issue = db.scalars(ordered(published_articles().where(TocEntry.issue_id == latest.id))).unique().all()
    acts = db.scalars(select(Activity).where(Activity.published.is_(True)).order_by(Activity.event_date.desc().nullslast()).limit(5)).all()
    n_issues, y0, y1 = db.execute(
        select(func.count(), func.min(Issue.year), func.max(Issue.year)).where(Issue.published.is_(True))
    ).one()
    n_articles = db.scalar(
        select(func.count()).select_from(TocEntry).join(Issue)
        .where(Issue.published.is_(True), TocEntry.is_front.is_(False))
    ) or 0
    # Chuyên mục: mỗi số đặc san thuộc một chuyên mục qua "Chủ đề (chuyên mục)" (Issue.theme = Field.name).
    # Liệt kê mọi chuyên mục, kể cả chuyên mục chưa có số nào (count = 0).
    published = db.scalars(select(Issue).where(Issue.published.is_(True)).order_by(Issue.number.desc())).all()
    topics = []
    for f in db.scalars(select(Field).order_by(Field.sort_order, Field.id)):
        mine = [i for i in published if (i.theme or "").strip() == f.name.strip()]
        topics.append({"name": f.name, "count": len(mine), "issues": [issue_card(i, c) for i in mine[:4]]})  # chỉ 4 số mới nhất
    return {
        "latest_issue": issue_card(latest, c) if latest else None,
        "hero": slides,
        "articles": [article_card(a) for a in in_issue],
        "fields": sections_of(in_issue),
        "issues": [issue_card(i, c) for i in recent],
        "activities": [activity_dict(a) for a in acts],
        "topics": topics,
        "stats": {"issue_count": n_issues, "article_count": n_articles, "year_from": y0, "year_to": y1},
    }


@router.get("/issues")
def issues(db: Session = Depends(get_db)):
    c = counts(db)
    rows = db.scalars(select(Issue).where(Issue.published.is_(True)).order_by(Issue.number.desc())).all()
    top = rows[0] if rows else None
    fields_ = sections_of(db.scalars(ordered(published_articles().where(TocEntry.issue_id == top.id))).unique().all()) if top else []
    return {
        "issues": [issue_card(i, c) for i in rows],
        "fields": fields_,
    }


@router.get("/issues/{slug}")
def issue_detail(slug: str, preview: str | None = None, db: Session = Depends(get_db)):
    pid = preview_issue_id(preview)
    i = db.scalars(select(Issue).where(Issue.slug == slug)).first()
    if not i or not (i.published or i.id == pid):
        raise HTTPException(404, "Không tìm thấy số này")
    arts = db.scalars(ordered(visible_articles(pid).where(TocEntry.issue_id == i.id))).unique().all()
    groups: list[dict] = []
    for a in arts:
        if a.is_front:
            continue
        name = a.field.name if a.field else "Khác"
        g = next((g for g in groups if g["field"] == name), None)
        if not g:
            g = {"field": name, "items": []}
            groups.append(g)
        g["items"].append(article_card(a))
    return {
        "issue": issue_card(i, counts(db)),
        "front": [article_card(a) for a in arts if a.is_front],
        "groups": groups,
        "total": len(arts),
        "preview": not i.published,
    }


@router.get("/articles/{slug}")
def article_detail(slug: str, preview: str | None = None, db: Session = Depends(get_db)):
    pid = preview_issue_id(preview)
    a = db.scalars(visible_articles(pid).where(TocEntry.slug == slug)).unique().first()
    if not a:
        raise HTTPException(404, "Không tìm thấy bài viết")
    siblings = db.scalars(ordered(visible_articles(pid).where(TocEntry.issue_id == a.issue_id))).unique().all()
    pos = next(k for k, s in enumerate(siblings) if s.id == a.id)
    prev_, next_ = siblings[(pos - 1) % len(siblings)], siblings[(pos + 1) % len(siblings)]
    toc = ([ "Lời dẫn" ] if a.lead else []) + headings(a.body)
    cite = f"{a.author} ({a.issue.year}). {a.title}. Đặc san Khoa học & Phát triển thành phố Đà Nẵng, {a.issue.label.lower()}, {a.page_label}."
    # mục lục của cả số cho ngăn kéo
    groups: list[dict] = []
    for s in siblings:
        name = s.field.name if s.field else "Khác"
        g = next((g for g in groups if g["field"] == name), None)
        if not g:
            g = {"field": name, "items": []}
            groups.append(g)
        g["items"].append({"slug": s.slug, "title": s.title, "page_label": s.page_label})
    return {
        **article_card(a),
        "lead": a.lead,
        "body": a.body or "",
        "toc": toc,
        "citation": cite,
        "pdf_url": a.issue.pdf_url,
        "position": {"index": pos + 1, "total": len(siblings)},
        "prev": {"slug": prev_.slug, "title": prev_.title},
        "next": {"slug": next_.slug, "title": next_.title},
        "issue_toc": groups,
        "preview": not a.issue.published,
        "related": [article_card(s) for s in siblings if s.id != a.id][2:5],
    }


def post_card(p: Post) -> dict:
    """Thẻ bài viết: đoạn đầu làm tóm tắt, ảnh đầu tiên (nếu có) làm ảnh đại diện. p.body là HTML từ trình soạn thảo."""
    return {"slug": p.slug, "title": p.title, "author": p.author, "published_at": p.published_at.isoformat() if p.published_at else None,
            "excerpt": html_excerpt(p.body), "cover": p.cover_url or html_first_image(p.body)}


@router.get("/posts")
def posts_list(db: Session = Depends(get_db)):
    """Bài viết độc lập đã công bố, mới nhất trước."""
    q = select(Post).where(Post.published.is_(True)).order_by(Post.published_at.desc().nullslast(), Post.id.desc())
    return [post_card(p) for p in db.scalars(q)]


@router.get("/posts/{slug}")
def post_detail(slug: str, db: Session = Depends(get_db)):
    p = db.scalars(select(Post).where(Post.slug == slug, Post.published.is_(True))).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy bài viết")
    body, toc = html_add_heading_ids(p.body)
    return {**post_card(p), "body": body, "toc": toc, "cover_url": p.cover_url,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None}


SEARCH_LIMIT = 100


@router.get("/search")
def search(
    q: str = Query("", max_length=100),
    issue: str | None = None,
    field: str | None = None,
    author: str = Query("", max_length=100),
    year: int | None = None,
    db: Session = Depends(get_db),
):
    """Tìm bài theo từ khóa (tiêu đề, tác giả, lời dẫn, toàn văn) và/hoặc lọc theo số, chuyên mục, tác giả, năm."""
    q, author = q.strip(), author.strip()
    if q and len(q) < 2:
        raise HTTPException(422, "Từ khóa cần ít nhất 2 ký tự")
    if author and len(author) < 2:
        raise HTTPException(422, "Tên tác giả cần ít nhất 2 ký tự")
    if not (q or issue or field or author or year):
        raise HTTPException(422, "Nhập từ khóa hoặc chọn ít nhất một bộ lọc")
    stmt = published_articles()
    if q:
        stmt = stmt.where(or_(like(TocEntry.title, q), like(TocEntry.author, q), like(TocEntry.lead, q), like(TocEntry.body, q)))
    if author:
        stmt = stmt.where(like(TocEntry.author, author))
    if issue:
        stmt = stmt.where(Issue.slug == issue)
    if year:
        stmt = stmt.where(Issue.year == year)
    if field:
        stmt = stmt.join(Field, TocEntry.field_id == Field.id).where(Field.name == field)
    total = db.scalar(select(func.count()).select_from(stmt.with_only_columns(TocEntry.id).subquery())) or 0
    rows = db.scalars(stmt.order_by(Issue.number.desc(), TocEntry.sort_order).limit(SEARCH_LIMIT)).unique().all()
    return {"q": q, "count": len(rows), "total": total, "results": [article_card(a) for a in rows]}


@router.get("/search/options")
def search_options(db: Session = Depends(get_db)):
    """Giá trị cho các ô lọc ở trang tìm kiếm: số, chuyên mục, năm (chỉ những gì có trong số đã công bố)."""
    issues_ = db.scalars(select(Issue).where(Issue.published.is_(True)).order_by(Issue.number.desc())).all()
    used = db.scalars(select(Field).join(TocEntry, TocEntry.field_id == Field.id).join(Issue, TocEntry.issue_id == Issue.id)
                      .where(Issue.published.is_(True)).distinct()).all()
    return {
        "issues": [{"slug": i.slug, "label": i.label} for i in issues_],
        "fields": [f.name for f in sorted(used, key=lambda f: (f.sort_order, f.id))],
        "years": sorted({i.year for i in issues_ if i.year}, reverse=True),
    }


@router.get("/research")
def research(db: Session = Depends(get_db)):
    rows = db.scalars(published_articles().where(TocEntry.is_research.is_(True)).order_by(Issue.number.desc(), TocEntry.sort_order)).unique().all()
    return [article_card(a) for a in rows]


@router.get("/activities")
def activities(db: Session = Depends(get_db)):
    rows = db.scalars(select(Activity).where(Activity.published.is_(True)).order_by(Activity.event_date.desc().nullslast())).all()
    return [activity_dict(a) for a in rows]


@router.get("/activities/{aid}")
def activity(aid: int, db: Session = Depends(get_db)):
    a = db.get(Activity, aid)
    if not a or not a.published:
        raise HTTPException(404, "Không tìm thấy hoạt động")
    return activity_dict(a)


@router.get("/featured")
def featured_items(db: Session = Depends(get_db)):
    """Trang "Tiêu điểm": mọi mục chọn trong quản trị (số đặc san, hoạt động, trang nội dung, bài viết), theo thứ tự sắp xếp."""
    return spotlight_items(db)


class ChatIn(BaseModel):
    question: str


@router.post("/chat")
def chat(body: ChatIn, db: Session = Depends(get_db)):
    """Trợ lý tra cứu dựa trên tìm kiếm (chưa dùng LLM)."""
    q = body.question.strip()[:200]
    if len(q) < 2:
        raise HTTPException(422, "Câu hỏi quá ngắn")
    low = q.lower()
    if "gửi bài" in low or "thể lệ" in low or "bản thảo" in low:
        return {"answer": "Bạn có thể gửi bản thảo trực tiếp bằng biểu mẫu Gửi bài; thể lệ và quy trình gửi bài có ở trang Hỏi đáp.", "link": "/gui-bai", "articles": []}
    words = [w for w in re.split(r"\W+", q) if len(w) >= 3]
    conds = [like(TocEntry.title, q), like(TocEntry.author, q)]
    conds += [like(TocEntry.title, w) for w in words[:6]] + [like(TocEntry.author, w) for w in words[:6]]
    rows = db.scalars(published_articles().where(or_(*conds)).order_by(Issue.number.desc(), TocEntry.sort_order).limit(5)).unique().all()
    if not rows:
        return {"answer": "Chưa tìm thấy bài phù hợp. Hãy thử tên tác giả hoặc từ khóa trong tiêu đề.", "link": None, "articles": []}
    return {"answer": f"Tìm thấy {len(rows)} bài phù hợp:", "link": None, "articles": [article_card(a) for a in rows]}


# ---------- trang nội dung tĩnh ----------
@router.get("/pages")
def pages(db: Session = Depends(get_db)):
    rows = db.scalars(select(Page).where(Page.published.is_(True)).order_by(Page.sort_order, Page.id)).all()
    return [{"slug": p.slug, "title": p.title} for p in rows]


@router.get("/pages/{slug}")
def page_detail(slug: str, db: Session = Depends(get_db)):
    p = db.scalars(select(Page).where(Page.slug == slug, Page.published.is_(True))).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy trang")
    return {"slug": p.slug, "title": p.title, "content": p.content or "",
            "updated_at": p.updated_at.isoformat() if p.updated_at else None}


# ---------- banner trang chủ ----------
@router.get("/banners")
def banners(db: Session = Depends(get_db)):
    """Banner đang hiển thị, theo vị trí rồi thứ tự. Kích thước theo vị trí: cấu hình banner_layout trong /site."""
    rows = db.scalars(select(Banner).where(Banner.published.is_(True), Banner.position.in_(BANNER_POSITIONS))
                      .order_by(Banner.position, Banner.sort_order, Banner.id)).all()
    return [{"id": b.id, "image_url": b.image_url, "link": b.link, "alt": b.alt, "position": b.position} for b in rows]
