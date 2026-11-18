import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from .config import settings
from .db import SessionLocal, engine
from .models import Base, User
from .routers import admin, public
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
    with SessionLocal() as db:
        email = settings.admin_email.strip().lower()
        if not db.scalars(select(User).where(User.email == email)).first():
            db.add(User(email=email, password_hash=hash_password(settings.admin_password), role="admin"))
            db.commit()
        if settings.seed_demo:
            seed(db)


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.media_dir, exist_ok=True)
    init_db()
    yield


app = FastAPI(title="Đặc san KH&PT Đà Nẵng API", version="1.0.0", lifespan=lifespan)
app.include_router(public.router, prefix="/api/v1/public")
app.include_router(admin.router, prefix="/api/v1/admin")
os.makedirs(settings.media_dir, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")


@app.get("/api/health")
def health():
    return {"status": "ok"}
