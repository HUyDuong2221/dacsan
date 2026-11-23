"""Xem nhật ký hoạt động (chỉ quản trị viên). Việc ghi nhật ký nằm ở services/audit.py."""
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AuditLog
from ..security import ADMIN, require_roles
from ..services import audit

router = APIRouter()


def _audit_dict(a: AuditLog) -> dict:
    return {
        "id": a.id, "user_id": a.user_id, "user_email": a.user_email,
        "action": a.action, "action_label": audit.ACTION_LABELS.get(a.action, a.action),
        "entity": a.entity, "entity_label": audit.ENTITY_LABELS.get(a.entity, a.entity),
        "entity_id": a.entity_id, "summary": a.summary, "method": a.method, "path": a.path,
        "status_code": a.status_code, "ip": a.ip, "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("/audit-logs/options", dependencies=[Depends(require_roles(*ADMIN))])
def audit_options(db: Session = Depends(get_db)):
    users = db.execute(select(AuditLog.user_email).where(AuditLog.user_email != "").distinct()).scalars().all()
    return {
        "entities": [{"value": k, "label": v} for k, v in audit.ENTITY_LABELS.items()],
        "actions": [{"value": k, "label": v} for k, v in audit.ACTION_LABELS.items()],
        "users": sorted(users),
    }


@router.get("/audit-logs", dependencies=[Depends(require_roles(*ADMIN))])
def audit_logs(entity: str = "", action: str = "", user: str = "", q: str = "", date_from: date | None = None,
               date_to: date | None = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    """Nhật ký hoạt động, mới nhất trước. Lọc theo đối tượng, thao tác, email người dùng, từ khóa, khoảng ngày."""
    conds = []
    if entity:
        conds.append(AuditLog.entity == entity)
    if action:
        conds.append(AuditLog.action == action)
    if user:
        conds.append(AuditLog.user_email == user)
    if q.strip():
        k = f"%{q.strip()[:100]}%"
        conds.append(or_(AuditLog.summary.ilike(k), AuditLog.user_email.ilike(k), AuditLog.path.ilike(k)))
    if date_from:
        conds.append(AuditLog.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        conds.append(AuditLog.created_at < datetime.combine(date_to + timedelta(days=1), time.min))
    limit, offset = max(1, min(limit, 200)), max(0, offset)
    total = db.scalar(select(func.count()).select_from(AuditLog).where(*conds)) or 0
    rows = db.scalars(select(AuditLog).where(*conds).order_by(AuditLog.id.desc()).offset(offset).limit(limit)).all()
    return {"total": total, "items": [_audit_dict(a) for a in rows]}
