import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from .config import settings
from .db import SessionLocal, engine
from .models import Activity, ActivityType, Base, Issue, User
from .routers import admin, public, submissions, users
from .security import hash_password
from .seed import seed


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
    Base.metadata.create_all(engine)
    with engine.begin() as conn:  # nâng cấp nhẹ cho DB đã có (chưa dùng Alembic)
        conn.execute(text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS published_at DATE"))
        conn.execute(text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS title VARCHAR(400)"))
        conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS content TEXT"))
        conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(500)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(200) NOT NULL DEFAULT ''"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()"))
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
            i.page_count = admin.pdf_page_count(i.pdf_url)
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.media_dir, exist_ok=True)
    os.makedirs(settings.private_dir, exist_ok=True)
    init_db()
    yield


app = FastAPI(title="Đặc san KH&PT Đà Nẵng API", version="1.0.0", lifespan=lifespan)
app.include_router(public.router, prefix="/api/v1/public")
app.include_router(admin.router, prefix="/api/v1/admin")
app.include_router(users.router, prefix="/api/v1/admin")
app.include_router(submissions.public_router, prefix="/api/v1/public")
app.include_router(submissions.admin_router, prefix="/api/v1/admin")
os.makedirs(settings.media_dir, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")


@app.get("/api/health")
def health():
    return {"status": "ok"}
