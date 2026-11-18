import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Activity, Article, Document, Field, Issue, Notice, Setting, Subscriber
from ..util import headings

router = APIRouter()
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------- serializers ----------
def has_text(a: Article) -> bool:
    return bool(a.body and a.body.strip())


def article_card(a: Article) -> dict:
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
        "theme": i.theme,
        "summary": i.summary,
        "cover_url": i.cover_url,
        "pdf_url": i.pdf_url,
        "page_count": i.page_count,
        "article_count": n,
    }


def counts(db: Session) -> dict[int, int]:
    rows = db.execute(
        select(Article.issue_id, func.count()).where(Article.status == "published").group_by(Article.issue_id)
    ).all()
    return {r[0]: r[1] for r in rows}


def published_articles():
    return select(Article).join(Issue).where(Article.status == "published", Issue.published.is_(True))


def activity_dict(a: Activity) -> dict:
    return {"id": a.id, "title": a.title, "kind": a.kind, "date": a.event_date.isoformat() if a.event_date else None, "url": a.url}


def notice_dict(n: Notice) -> dict:
    return {"id": n.id, "tag": n.tag, "title": n.title, "content": n.content, "date": n.notice_date.isoformat() if n.notice_date else None}


def ordered(q):
    return q.order_by(Article.sort_order, Article.id)


def latest_issue(db: Session) -> Issue | None:
    return db.scalars(select(Issue).where(Issue.published.is_(True)).order_by(Issue.number.desc())).first()


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
    hero = db.scalars(
        ordered(published_articles().where(Article.featured.is_(True))).limit(6)
    ).unique().all()
    issues = db.scalars(select(Issue).where(Issue.published.is_(True)).order_by(Issue.number.desc()).limit(8)).all()
    in_issue = []
    if latest:
        in_issue = db.scalars(ordered(published_articles().where(Article.issue_id == latest.id))).unique().all()
    acts = db.scalars(select(Activity).where(Activity.published.is_(True)).order_by(Activity.event_date.desc().nullslast()).limit(5)).all()
    return {
        "latest_issue": issue_card(latest, c) if latest else None,
        "hero": [
            {**article_card(a), "excerpt": a.hero_excerpt or (a.lead or "")} for a in hero
        ],
        "articles": [article_card(a) for a in in_issue],
        "fields": [f.name for f in db.scalars(select(Field).order_by(Field.sort_order, Field.id))],
        "issues": [issue_card(i, c) for i in issues],
        "activities": [activity_dict(a) for a in acts],
    }


@router.get("/issues")
def issues(db: Session = Depends(get_db)):
    c = counts(db)
    rows = db.scalars(select(Issue).where(Issue.published.is_(True)).order_by(Issue.number.desc())).all()
    notices = db.scalars(select(Notice).where(Notice.published.is_(True)).order_by(Notice.notice_date.desc().nullslast()).limit(6)).all()
    fields_ = [f.name for f in db.scalars(select(Field).order_by(Field.sort_order, Field.id))]
    return {
        "issues": [issue_card(i, c) for i in rows],
        "notices": [notice_dict(n) for n in notices],
        "fields": fields_,
    }


@router.get("/issues/{slug}")
def issue_detail(slug: str, db: Session = Depends(get_db)):
    i = db.scalars(select(Issue).where(Issue.slug == slug, Issue.published.is_(True))).first()
    if not i:
        raise HTTPException(404, "Không tìm thấy số này")
    arts = db.scalars(ordered(published_articles().where(Article.issue_id == i.id))).unique().all()
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
    }


@router.get("/articles/{slug}")
def article_detail(slug: str, db: Session = Depends(get_db)):
    a = db.scalars(published_articles().where(Article.slug == slug)).unique().first()
    if not a:
        raise HTTPException(404, "Không tìm thấy bài viết")
    siblings = db.scalars(ordered(published_articles().where(Article.issue_id == a.issue_id))).unique().all()
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
        "related": [article_card(s) for s in siblings if s.id != a.id][2:5],
    }


@router.get("/search")
def search(
    q: str = Query(min_length=2, max_length=100),
    issue: str | None = None,
    field: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = published_articles().where(
        or_(like(Article.title, q), like(Article.author, q), like(Article.lead, q), like(Article.body, q))
    )
    if issue:
        stmt = stmt.where(Issue.slug == issue)
    if field:
        stmt = stmt.join(Field, Article.field_id == Field.id).where(Field.name == field)
    rows = db.scalars(stmt.order_by(Issue.number.desc(), Article.sort_order).limit(50)).unique().all()
    return {"q": q, "count": len(rows), "results": [article_card(a) for a in rows]}


@router.get("/research")
def research(db: Session = Depends(get_db)):
    rows = db.scalars(published_articles().where(Article.is_research.is_(True)).order_by(Issue.number.desc(), Article.sort_order)).unique().all()
    return [article_card(a) for a in rows]


@router.get("/documents")
def documents(db: Session = Depends(get_db)):
    rows = db.scalars(select(Document).where(Document.published.is_(True)).order_by(Document.sort_order, Document.id)).all()
    return [{"id": d.id, "title": d.title, "doc_type": d.doc_type, "file_url": d.file_url, "updated": d.updated_at.date().isoformat()} for d in rows]


@router.get("/notices")
def notices(db: Session = Depends(get_db)):
    rows = db.scalars(select(Notice).where(Notice.published.is_(True)).order_by(Notice.notice_date.desc().nullslast())).all()
    return [notice_dict(n) for n in rows]


@router.get("/activities")
def activities(db: Session = Depends(get_db)):
    rows = db.scalars(select(Activity).where(Activity.published.is_(True)).order_by(Activity.event_date.desc().nullslast())).all()
    return [activity_dict(a) for a in rows]


class SubscribeIn(BaseModel):
    email: str


@router.post("/subscribe")
def subscribe(body: SubscribeIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email) or len(email) > 255:
        raise HTTPException(422, "Email không hợp lệ")
    if not db.scalars(select(Subscriber).where(Subscriber.email == email)).first():
        db.add(Subscriber(email=email))
        db.commit()
    return {"ok": True}


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
        return {"answer": "Xem thể lệ gửi bài, mẫu bản thảo và quy trình phản biện tại mục Tư liệu.", "link": "/docs", "articles": []}
    words = [w for w in re.split(r"\W+", q) if len(w) >= 3]
    conds = [like(Article.title, q), like(Article.author, q)]
    conds += [like(Article.title, w) for w in words[:6]] + [like(Article.author, w) for w in words[:6]]
    rows = db.scalars(published_articles().where(or_(*conds)).order_by(Issue.number.desc(), Article.sort_order).limit(5)).unique().all()
    if not rows:
        return {"answer": "Chưa tìm thấy bài phù hợp. Hãy thử tên tác giả hoặc từ khóa trong tiêu đề.", "link": None, "articles": []}
    return {"answer": f"Tìm thấy {len(rows)} bài phù hợp:", "link": None, "articles": [article_card(a) for a in rows]}
