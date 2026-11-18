from pathlib import Path
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from app.core import get_db, settings
from app.models import Document, Issue, User
from app.api import public, admin
from app import content
from app.auth import router as auth_router, get_optional_user

app = FastAPI(title='Đặc san Khoa học & Phát triển API', version='0.1.0',description='REST API cho đặc san điện tử và CMS')
app.add_middleware(CORSMiddleware,allow_origins=[s.strip() for s in settings().cors_origins.split(',')], allow_credentials=True, allow_methods=['GET','POST','PATCH','PUT','DELETE','OPTIONS'],allow_headers=['Content-Type','Authorization','X-CSRF-Token'])
root=Path(settings().media_root)
root.mkdir(parents=True,exist_ok=True)


@app.get('/media/{key:path}', tags=['System'])
def media(key: str, db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    """Serve covers/PDFs of published issues and files of published documents; editors may fetch drafts. Raw imports are never public."""
    base = Path(settings().media_root).resolve()
    target = (base / key).resolve()
    if base not in target.parents or not target.is_file():
        raise HTTPException(404, 'Không tìm thấy tệp.')
    rel = target.relative_to(base).as_posix()
    is_editor = user is not None and user.role in {'admin', 'editor'}
    if not is_editor:
        public_issue = db.scalar(select(Issue.id).where(Issue.status == 'published', (Issue.cover_key == rel) | (Issue.pdf_key == rel)))
        public_doc = db.scalar(select(Document.id).where(Document.status == 'published', Document.file_key == rel)) if not public_issue else None
        if not public_issue and not public_doc:
            raise HTTPException(404, 'Không tìm thấy tệp.')
    return FileResponse(target, headers={'Cache-Control': 'public, max-age=3600' if not is_editor else 'private, no-store', 'X-Content-Type-Options': 'nosniff'})

app.include_router(auth_router,prefix='/api/v1')
app.include_router(public,prefix='/api/v1')
app.include_router(admin,prefix='/api/v1')
app.include_router(content.public,prefix='/api/v1')
app.include_router(content.admin,prefix='/api/v1')


@app.get('/health',tags=['System'])
def health(): return {'status':'ok'}
