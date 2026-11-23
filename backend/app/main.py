import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from .services.audit import AuditMiddleware
from .config import settings
from .db import SessionLocal, engine
from .models import Activity, ActivityType, Base, Issue, User
from .routers import (accounts, admin, audit_logs, backups, mail, media, public, reviews, stats, submissions,
                      toc_import, users)
from .security import hash_password
from .seed import seed


def run_migrations() -> None:
    """alembic upgrade head (migrations trong app/migrations). Chạy sau các bước nâng cấp thủ công ở init_db()."""
    from alembic import command
    from alembic.config import Config

    cfg = Config()
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "migrations"))
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")


def init_db() -> None:
    for attempt in range(30):  # chờ Postgres sẵn sàng
        try:
            with engine.begin() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent"))
            break
        except OperationalError:
            if attempt == 29:
                raise
            time.sleep(2)
    with engine.begin() as conn:  # đổi tên bảng cũ "articles" -> "toc_entries" (DB tạo từ phiên bản trước)
        conn.execute(text(
            "DO $$ BEGIN IF to_regclass('public.articles') IS NOT NULL AND to_regclass('public.toc_entries') IS NULL "
            "THEN ALTER TABLE articles RENAME TO toc_entries; END IF; END $$"
        ))
        conn.execute(text("ALTER TABLE IF EXISTS toc_entries DROP COLUMN IF EXISTS status"))
    # Bảng cũ vẫn tạo bằng create_all; bảng có info["alembic"] do migration Alembic tạo (xem run_migrations()).
    Base.metadata.create_all(engine, tables=[t for t in Base.metadata.sorted_tables if not t.info.get("alembic")])
    with engine.begin() as conn:  # nâng cấp nhẹ cho DB đã có (chưa dùng Alembic)
        conn.execute(text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS published_at DATE"))
        conn.execute(text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS title VARCHAR(400)"))
        conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS content TEXT"))
        conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(500)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(200) NOT NULL DEFAULT ''"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()"))
    run_migrations()
    with SessionLocal() as db:
        email = settings.admin_email.strip().lower()
        if not db.scalars(select(User).where(User.email == email)).first():
            db.add(User(email=email, password_hash=hash_password(settings.admin_password), role="admin"))
            db.commit()
        if settings.seed_demo:
            seed(db)
        # đưa các "loại" đang dùng ở hoạt động vào danh sách chọn (để ô chọn không bị trống với dữ liệu cũ)
        have = set(db.scalars(select(ActivityType.name)))
        for k in dict.fromkeys(db.scalars(select(Activity.kind).order_by(Activity.id))):
            if k and k not in have:
                db.add(ActivityType(name=k, sort_order=len(have)))
                have.add(k)
        # số đã có PDF nhưng chưa có số trang: tự đếm từ file PDF
        for i in db.scalars(select(Issue).where(Issue.page_count.is_(None), Issue.pdf_url.is_not(None))):
            i.page_count = media.pdf_page_count(i.pdf_url)
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.media_dir, exist_ok=True)
    os.makedirs(settings.private_dir, exist_ok=True)
    init_db()
    yield


app = FastAPI(title="Đặc san KH&PT Đà Nẵng API", version="1.0.0", lifespan=lifespan)
app.add_middleware(AuditMiddleware)
app.include_router(public.router, prefix="/api/v1/public")
app.include_router(admin.router, prefix="/api/v1/admin")
app.include_router(media.router, prefix="/api/v1/admin")
app.include_router(toc_import.router, prefix="/api/v1/admin")
app.include_router(audit_logs.router, prefix="/api/v1/admin")
app.include_router(accounts.router, prefix="/api/v1/admin")
app.include_router(users.router, prefix="/api/v1/admin")
app.include_router(submissions.public_router, prefix="/api/v1/public")
app.include_router(submissions.admin_router, prefix="/api/v1/admin")
app.include_router(reviews.public_router, prefix="/api/v1/public")
app.include_router(reviews.admin_router, prefix="/api/v1/admin")
app.include_router(stats.public_router, prefix="/api/v1/public")
app.include_router(stats.admin_router, prefix="/api/v1/admin")
app.include_router(mail.admin_router, prefix="/api/v1/admin")
app.include_router(mail.public_router, prefix="/api/v1/public")
app.include_router(backups.router, prefix="/api/v1/admin")
os.makedirs(settings.media_dir, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")


@app.get("/api/health")
def health():
    return {"status": "ok"}
