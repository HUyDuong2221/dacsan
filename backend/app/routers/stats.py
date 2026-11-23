"""Báo cáo và thống kê.

- public  POST /track            : trình duyệt báo một lượt xem trang / đọc PDF / tải PDF (navigator.sendBeacon).
- admin   GET  /stats            : số liệu bài gửi + lượt xem/đọc/tải trong khoảng ngày.
- admin   GET  /stats/export     : như trên, xuất file Excel (.xlsx).

Lượt được cộng dồn theo ngày (giờ Việt Nam) vào view_stats. Bỏ qua bot, số chưa công bố, và lượt lặp lại
của cùng IP với cùng mục trong DEDUP_SECONDS (trình duyệt cũng tự chống lặp trong một phiên).
"""
import io
import re
import time
from datetime import date, datetime, timedelta, timezone
from statistics import median

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import SUBMISSION_STATUSES, Issue, Submission, SubmissionHistory, TocEntry, ViewStat
from ..security import client_ip, require_roles

public_router = APIRouter()
admin_router = APIRouter(prefix="/stats", dependencies=[Depends(require_roles("admin", "editor"))])

VN = timezone(timedelta(hours=7))
KINDS = {"view": "Lượt xem", "read": "Lượt đọc PDF", "download": "Lượt tải PDF"}
FINAL = {"approved", "accepted", "rejected"}  # đã có quyết định cuối
ACCEPTED = {"approved", "accepted"}
BOT_RE = re.compile(r"bot|crawl|spider|slurp|preview|headless|python-|curl|wget|httpx|monitor", re.I)
DEDUP_SECONDS = 30 * 60
_seen: dict[tuple, float] = {}


def today_vn() -> date:
    return datetime.now(VN).date()


# ---------- ghi lượt ----------
class TrackIn(BaseModel):
    kind: str
    issue: str  # slug số đặc san
    article: str | None = None  # slug bài (nếu lượt thuộc về một bài)


def _bump(db: Session, day: date, kind: str, ttype: str, tid: int) -> None:
    """Tăng count của (day, kind, ttype, tid) lên 1 (upsert, chạy được trên Postgres và SQLite)."""
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    t = ViewStat.__table__
    stmt = insert(t).values(day=day, kind=kind, target_type=ttype, target_id=tid, count=1)
    db.execute(stmt.on_conflict_do_update(index_elements=["day", "kind", "target_type", "target_id"],
                                          set_={"count": t.c.count + 1}))


def _first_time(key: tuple) -> bool:
    now = time.time()
    if len(_seen) > 50_000:  # dọn bộ nhớ chống lặp
        for k in [k for k, t in _seen.items() if now - t > DEDUP_SECONDS]:
            _seen.pop(k, None)
    if now - _seen.get(key, 0) < DEDUP_SECONDS:
        return False
    _seen[key] = now
    return True


def reset_dedup() -> None:
    _seen.clear()




@public_router.post("/track", status_code=204)
def track(body: TrackIn, request: Request, db: Session = Depends(get_db)):
    if body.kind not in KINDS or BOT_RE.search(request.headers.get("user-agent", "")):
        return Response(status_code=204)
    issue = db.scalars(select(Issue).where(Issue.slug == body.issue[:120], Issue.published.is_(True))).first()
    if not issue:
        return Response(status_code=204)
    article = None
    if body.article:
        article = db.scalars(select(TocEntry).where(TocEntry.slug == body.article[:300], TocEntry.issue_id == issue.id)).first()
        if not article:
            return Response(status_code=204)
    if not _first_time((client_ip(request), body.kind, issue.id, article.id if article else None)):
        return Response(status_code=204)
    day = today_vn()
    # lượt trên trang bài tính cho cả bài và số chứa bài; lượt xem trang bài không tính là xem trang mục lục của số
    if article:
        _bump(db, day, body.kind, "article", article.id)
    if not (article and body.kind == "view"):
        _bump(db, day, body.kind, "issue", issue.id)
    db.commit()
    return Response(status_code=204)


# ---------- báo cáo ----------
def _range(date_from: date | None, date_to: date | None) -> tuple[date, date]:
    end = date_to or today_vn()
    start = date_from or end - timedelta(days=29)
    if start > end:
        raise HTTPException(422, "Ngày bắt đầu phải trước ngày kết thúc")
    if (end - start).days > 3660:
        raise HTTPException(422, "Khoảng thời gian tối đa 10 năm")
    return start, end


def _vn_day(dt: datetime | None) -> date | None:
    if dt is None:
        return None
    if dt.tzinfo is None:  # SQLite trả về datetime không múi giờ (UTC)
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(VN).date()


def _days(a: datetime, b: datetime) -> float:
    if a.tzinfo is None:
        a = a.replace(tzinfo=timezone.utc)
    if b.tzinfo is None:
        b = b.replace(tzinfo=timezone.utc)
    return max(0.0, (b - a).total_seconds() / 86400)


def build_report(db: Session, start: date, end: date) -> dict:
    # --- bài gửi trong khoảng (theo ngày gửi) ---
    subs = [s for s in db.scalars(select(Submission).order_by(Submission.id)) if start <= (_vn_day(s.created_at) or start) <= end]
    ids = [s.id for s in subs]
    hist: dict[int, list[SubmissionHistory]] = {}
    if ids:
        for h in db.scalars(select(SubmissionHistory).where(SubmissionHistory.submission_id.in_(ids)).order_by(SubmissionHistory.id)):
            hist.setdefault(h.submission_id, []).append(h)
    rows, decide_days, respond_days = [], [], []
    for s in subs:
        hs = hist.get(s.id, [])
        final = next((h for h in hs if h.to_status in FINAL and h.from_status != h.to_status), None)
        first = next((h for h in hs if h.changed_by is not None), None)  # thao tác đầu tiên của ban biên tập
        d = _days(s.created_at, final.changed_at) if final else None
        if d is not None:
            decide_days.append(d)
        if first:
            respond_days.append(_days(s.created_at, first.changed_at))
        rows.append({
            "id": s.id, "code": s.code, "created": _vn_day(s.created_at).isoformat(), "title": s.title, "author": s.name,
            "field": s.field_name, "status": s.status, "status_label": SUBMISSION_STATUSES.get(s.status, s.status),
            "decided": _vn_day(final.changed_at).isoformat() if final else None,
            "decision": SUBMISSION_STATUSES.get(final.to_status) if final else None,
            "days": round(d, 1) if d is not None else None,
        })
    decided = [s for s in subs if s.status in FINAL]
    by_status = [{"status": k, "label": v, "count": sum(1 for s in subs if s.status == k)} for k, v in SUBMISSION_STATUSES.items()]
    months: dict[str, dict] = {}
    for s in subs:
        m = _vn_day(s.created_at).strftime("%Y-%m")
        x = months.setdefault(m, {"month": m, "total": 0, "accepted": 0, "rejected": 0})
        x["total"] += 1
        x["accepted"] += s.status in ACCEPTED
        x["rejected"] += s.status == "rejected"

    def avg(xs):
        return round(sum(xs) / len(xs), 1) if xs else None

    # --- lượt xem/đọc/tải ---
    vs = db.execute(select(ViewStat.day, ViewStat.kind, ViewStat.target_type, ViewStat.target_id, ViewStat.count)
                    .where(ViewStat.day >= start, ViewStat.day <= end)).all()
    totals = {k: 0 for k in KINDS}
    # tổng lượt xem trang = xem trang số + xem trang bài; đọc/tải tính theo số (không cộng trùng phần của bài)
    for r in vs:
        if r.kind == "view" or r.target_type == "issue":
            totals[r.kind] += r.count
    daily = {(start + timedelta(days=i)).isoformat(): {k: 0 for k in KINDS} for i in range((end - start).days + 1)}
    per: dict[tuple, dict] = {}
    for r in vs:
        if r.kind == "view" or r.target_type == "issue":
            daily[r.day.isoformat()][r.kind] += r.count
        x = per.setdefault((r.target_type, r.target_id), {k: 0 for k in KINDS})
        x[r.kind] += r.count
    issues = {i.id: i for i in db.scalars(select(Issue).where(Issue.id.in_([t for (tt, t) in per if tt == "issue"] or [0])))}
    arts = {a.id: a for a in db.scalars(select(TocEntry).where(TocEntry.id.in_([t for (tt, t) in per if tt == "article"] or [0])))}

    def top(ttype: str, limit: int | None = 10):
        out = []
        for (tt, tid), c in per.items():
            if tt != ttype:
                continue
            o = issues.get(tid) if ttype == "issue" else arts.get(tid)
            name = (o.label if ttype == "issue" else o.title) if o else "(đã xóa)"
            extra = {"slug": o.slug if o else None}
            if ttype == "article":
                extra.update(author=o.author if o else "", issue=o.issue.label if o else "")
            out.append({"id": tid, "name": name, **extra, **c, "total": sum(c.values())})
        out.sort(key=lambda x: (-x["view"], -x["total"], x["name"]))
        return out[:limit] if limit else out

    return {
        "range": {"from": start.isoformat(), "to": end.isoformat()},
        "submissions": {
            "total": len(subs), "decided": len(decided), "accepted": sum(1 for s in decided if s.status in ACCEPTED),
            "rejected": sum(1 for s in decided if s.status == "rejected"),
            "acceptance_rate": round(100 * sum(1 for s in decided if s.status in ACCEPTED) / len(decided), 1) if decided else None,
            "avg_decision_days": avg(decide_days), "median_decision_days": round(median(decide_days), 1) if decide_days else None,
            "avg_first_response_days": avg(respond_days),
            "by_status": by_status, "by_month": sorted(months.values(), key=lambda x: x["month"]), "rows": rows,
        },
        "traffic": {
            "totals": totals, "daily": [{"day": d, **c} for d, c in daily.items()],
            "top_articles": top("article"), "top_issues": top("issue"),
            "all_articles": top("article", None), "all_issues": top("issue", None),
        },
    }


@admin_router.get("")
def stats(date_from: date | None = None, date_to: date | None = None, db: Session = Depends(get_db)):
    start, end = _range(date_from, date_to)
    rep = build_report(db, start, end)
    rep["submissions"].pop("rows")
    rep["traffic"].pop("all_articles")
    rep["traffic"].pop("all_issues")
    return rep


@admin_router.get("/export")
def export(date_from: date | None = None, date_to: date | None = None, db: Session = Depends(get_db)):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    start, end = _range(date_from, date_to)
    rep = build_report(db, start, end)
    sub, tr = rep["submissions"], rep["traffic"]
    wb = Workbook()
    head_font, head_fill = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor="0B4F9C")

    def sheet(title: str, headers: list[str], data: list[list], widths: list[int], first: bool = False):
        ws = wb.active if first else wb.create_sheet()
        ws.title = title
        ws.append(headers)
        for c in ws[1]:
            c.font, c.fill, c.alignment = head_font, head_fill, Alignment(vertical="center", wrap_text=True)
        for r in data:
            ws.append(r)
            # chữ do người ngoài nhập (tiêu đề bài gửi...) không được thành công thức Excel: "=HYPERLINK(...)"
            for c in ws[ws.max_row]:
                if isinstance(c.value, str):
                    c.data_type = "s"
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w
        ws.freeze_panes = "A2"
        if data:
            ws.auto_filter.ref = ws.dimensions
        return ws

    period = f"{start.strftime('%d/%m/%Y')} – {end.strftime('%d/%m/%Y')}"
    pct = f"{sub['acceptance_rate']}%" if sub["acceptance_rate"] is not None else "—"
    ws = sheet("Tổng quan", ["Chỉ số", "Giá trị"], [
        ["Kỳ báo cáo", period],
        ["Xuất lúc", datetime.now(VN).strftime("%d/%m/%Y %H:%M")],
        ["Bài gửi nhận được", sub["total"]],
        ["Bài đã có quyết định (chấp nhận/từ chối)", sub["decided"]],
        ["  trong đó chấp nhận", sub["accepted"]],
        ["  trong đó từ chối", sub["rejected"]],
        ["Tỷ lệ chấp nhận (trên số bài đã quyết định)", pct],
        ["Thời gian đến quyết định, trung bình (ngày)", sub["avg_decision_days"] if sub["avg_decision_days"] is not None else "—"],
        ["Thời gian đến quyết định, trung vị (ngày)", sub["median_decision_days"] if sub["median_decision_days"] is not None else "—"],
        ["Thời gian phản hồi đầu tiên, trung bình (ngày)", sub["avg_first_response_days"] if sub["avg_first_response_days"] is not None else "—"],
        ["Lượt xem trang (số + bài)", tr["totals"]["view"]],
        ["Lượt đọc PDF", tr["totals"]["read"]],
        ["Lượt tải PDF", tr["totals"]["download"]],
    ], [48, 26], first=True)
    ws.append([])
    ws.append(["Ghi chú: thời gian xử lý tính từ ngày gửi đến quyết định Chấp nhận/Từ chối đầu tiên trong lịch sử bài; "
               "bài gửi trước khi có lịch sử không có số liệu thời gian."])
    sheet("Bài gửi theo tháng", ["Tháng", "Bài gửi", "Chấp nhận", "Từ chối"],
          [[m["month"], m["total"], m["accepted"], m["rejected"]] for m in sub["by_month"]], [12, 12, 12, 12])
    sheet("Bài gửi theo trạng thái", ["Trạng thái", "Số bài"], [[s["label"], s["count"]] for s in sub["by_status"]], [26, 12])
    sheet("Bài gửi", ["Mã", "Ngày gửi", "Tiêu đề", "Tác giả", "Chuyên mục đề xuất", "Trạng thái hiện tại", "Quyết định",
                      "Ngày quyết định", "Số ngày xử lý"],
          [[r["code"], r["created"], r["title"], r["author"], r["field"], r["status_label"], r["decision"] or "",
            r["decided"] or "", r["days"] if r["days"] is not None else ""] for r in sub["rows"]],
          [11, 12, 60, 24, 22, 20, 16, 15, 13])
    sheet("Lượt theo bài", ["Bài", "Tác giả", "Số", "Lượt xem", "Lượt đọc PDF", "Lượt tải PDF"],
          [[a["name"], a.get("author", ""), a.get("issue", ""), a["view"], a["read"], a["download"]] for a in tr["all_articles"]],
          [60, 24, 18, 11, 13, 13])
    sheet("Lượt theo số", ["Số", "Lượt xem mục lục", "Lượt đọc PDF", "Lượt tải PDF"],
          [[i["name"], i["view"], i["read"], i["download"]] for i in tr["all_issues"]], [22, 17, 13, 13])
    sheet("Lượt theo ngày", ["Ngày", "Lượt xem trang", "Lượt đọc PDF", "Lượt tải PDF"],
          [[d["day"], d["view"], d["read"], d["download"]] for d in tr["daily"]], [12, 15, 13, 13])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    name = f"thong-ke-dac-san_{start.isoformat()}_{end.isoformat()}.xlsx"
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f'attachment; filename="{name}"'})
