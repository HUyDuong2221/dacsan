"""Public publishing API and authenticated editorial API."""
from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4
import bleach
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError
from app.core import get_db, settings
from app.auth import require_admin, require_editor
from app.models import User, Issue, Section, Article, ImportJob, AuditLog, utc_now
from app.importer import slugify

public = APIRouter(tags=['Public'])
admin = APIRouter(prefix='/admin', tags=['Editorial CMS'])


def apply_changes(obj, changes: dict, required: set[str], nullable: set[str] = frozenset()):
    """Apply a PATCH body. Fields sent as null are cleared only if allowed; required fields reject null."""
    for k, v in changes.items():
        if v is None:
            if k in required:
                raise HTTPException(422, f'Trường "{k}" không được để trống.')
            if k not in nullable:
                v = ''
        setattr(obj, k, v)


def issue_json(o: Issue, with_detail=False, for_admin=False):
    out = dict(id=o.id, number=o.number, month=o.month, year=o.year, slug=o.slug,
        title=o.title, theme=o.theme, description=o.description, cover_key=o.cover_key,
        pdf_key=o.pdf_key, page_count=o.page_count, status=o.status,
        published_at=o.published_at.isoformat() if o.published_at else None)
    if with_detail:
        out['editorial'] = o.editorial
        out['imprint'] = o.imprint
        out['sections'] = [dict(id=s.id, name=s.name, slug=s.slug, sort_order=s.sort_order,
            articles=[article_json(a) for a in sorted(s.articles, key=lambda a:a.sort_order) if for_admin or a.status == 'published' or o.status != 'published']) for s in o.sections]
    return out


def article_json(a: Article, with_detail=False, for_admin=False):
    out = dict(id=a.id, slug=a.slug, title=a.title, author_display=a.author_display,
        content_type=a.content_type, summary=a.summary,
        issue_id=a.issue_id, issue_slug=a.issue.slug, issue_title=a.issue.title,
        section_id=a.section_id, section_name=a.section.name if a.section else '',
        print_page_start=a.print_page_start, print_page_end=a.print_page_end,
        pdf_page_start=a.pdf_page_start, pdf_page_end=a.pdf_page_end,
        full_text_verified=a.full_text_verified, sort_order=a.sort_order, status=a.status)
    if with_detail:
        out['body_html'] = a.body_html if a.full_text_verified or for_admin else ''
        out['pdf_key'] = a.issue.pdf_key
    if for_admin:
        out['raw_extracted_text'] = a.raw_extracted_text
    return out


@public.get('/home')
def home(db: Session = Depends(get_db)):
    issues = db.scalars(select(Issue).where(Issue.status == 'published').order_by(Issue.year.desc(),Issue.month.desc()).limit(8)).all()
    articles = db.scalars(select(Article).join(Issue).where(Issue.status == 'published',Article.status == 'published').options(selectinload(Article.issue),selectinload(Article.section)).order_by(Issue.year.desc(), Issue.month.desc(), Article.sort_order).limit(8)).all()
    return {'latest_issue': issue_json(issues[0]) if issues else None,
            'recent_issues':[issue_json(i) for i in issues], 'featured_articles':[article_json(a) for a in articles]}


@public.get('/issues')
def list_issues(year: int | None = None, page: int = Query(1, ge=1), limit: int = Query(12, ge=1, le=100), db: Session = Depends(get_db)):
    stmt = select(Issue).where(Issue.status == 'published')
    if year: stmt = stmt.where(Issue.year == year)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    issues = db.scalars(stmt.order_by(Issue.year.desc(),Issue.month.desc()).offset((page-1)*limit).limit(limit)).all()
    return {'items':[issue_json(o) for o in issues], 'total':total, 'page':page, 'limit':limit}


@public.get('/issues/{slug}')
def get_issue(slug: str, db: Session = Depends(get_db)):
    o = db.scalar(select(Issue).where(Issue.slug == slug,Issue.status == 'published').options(selectinload(Issue.sections).selectinload(Section.articles).selectinload(Article.issue),selectinload(Issue.articles)))
    if not o: raise HTTPException(404,'Không tìm thấy số đặc san.')
    return issue_json(o,True)


@public.get('/articles/{slug}')
def get_article(slug: str, db: Session = Depends(get_db)):
    a = db.scalar(select(Article).join(Issue).where(Article.slug == slug, Issue.status == 'published', Article.status == 'published').options(selectinload(Article.issue),selectinload(Article.section)))
    if not a: raise HTTPException(404,'Không tìm thấy bài viết.')
    return article_json(a,True)


@public.get('/search')
def search(q: str = Query('', max_length=200), page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=50), db: Session = Depends(get_db)):
    q = q.strip()
    if not q: return {'items':[],'total':0,'page':page,'limit':limit}
    stmt = select(Article).join(Issue).where(Issue.status=='published',Article.status=='published',
        or_(Article.title.ilike(f'%{q}%'),Article.author_display.ilike(f'%{q}%'),Article.summary.ilike(f'%{q}%'),and_(Article.full_text_verified.is_(True),Article.body_html.ilike(f'%{q}%'))))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(stmt.options(selectinload(Article.issue),selectinload(Article.section)).order_by(Issue.year.desc(),Article.sort_order).offset((page-1)*limit).limit(limit)).all()
    return {'items':[article_json(a) for a in items], 'total':total, 'page':page, 'limit':limit}


@admin.get('/dashboard')
def dashboard(db:Session=Depends(get_db), user:User=Depends(require_editor)):
    return {'issues':db.scalar(select(func.count()).select_from(Issue)) or 0,
      'articles':db.scalar(select(func.count()).select_from(Article)) or 0,
      'unverified':db.scalar(select(func.count()).select_from(Article).where(Article.full_text_verified.is_(False))) or 0,
      'published_issues':db.scalar(select(func.count()).select_from(Issue).where(Issue.status=='published')) or 0}


@admin.get('/issues')
def admin_issues(db:Session=Depends(get_db), user:User=Depends(require_editor)):
    return [issue_json(o) for o in db.scalars(select(Issue).order_by(Issue.year.desc(),Issue.month.desc())).all()]


@admin.get('/issues/{issue_id}')
def admin_issue(issue_id:str,db:Session=Depends(get_db),user:User=Depends(require_editor)):
    o=db.scalar(select(Issue).where(Issue.id==issue_id).options(selectinload(Issue.sections).selectinload(Section.articles).selectinload(Article.issue)))
    if not o: raise HTTPException(404,'Không tìm thấy số.')
    return issue_json(o, True, for_admin=True)


class IssueCreate(BaseModel):
    number: int = Field(ge=1,le=9999)
    month: int = Field(ge=1,le=12)
    year: int = Field(ge=1900,le=2200)
    title: str = Field(min_length=2,max_length=500)
    theme: str = Field(default='',max_length=600)


@admin.post('/issues',status_code=201)
def create_issue(body:IssueCreate, db:Session=Depends(get_db), user:User=Depends(require_editor)):
    slug=f'so-{body.number}-{body.month}-{body.year}'
    if db.scalar(select(Issue.id).where(Issue.number==body.number,Issue.year==body.year)):
        raise HTTPException(409,'Số phát hành này đã tồn tại trong năm đã chọn. Hãy mở số hiện có để biên tập.')
    o=Issue(**body.model_dump(),slug=slug,status='draft')
    db.add(o)
    try: db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,'Số phát hành này đã tồn tại trong năm đã chọn.')
    db.refresh(o)
    return issue_json(o)


class IssuePatch(BaseModel):
    number: int | None = Field(default=None,ge=1,le=9999)
    month: int | None = Field(default=None,ge=1,le=12)
    year: int | None = Field(default=None,ge=1900,le=2200)
    title: str | None = Field(default=None,min_length=2,max_length=500)
    theme: str | None = Field(default=None,max_length=600)
    description: str | None = None
    editorial: str | None = None
    imprint: str | None = None


@admin.patch('/issues/{issue_id}')
def patch_issue(issue_id:str,body:IssuePatch,db:Session=Depends(get_db),user:User=Depends(require_editor)):
    o=db.get(Issue,issue_id)
    if not o: raise HTTPException(404,'Không tìm thấy số.')
    changes=body.model_dump(exclude_unset=True)
    number=changes.get('number') or o.number
    year=changes.get('year') or o.year
    if any(changes.get(k,1) is None for k in ('number','month','year','title')):
        raise HTTPException(422,'Số, tháng, năm và tiêu đề không được để trống.')
    if db.scalar(select(Issue.id).where(Issue.id!=issue_id,Issue.number==number,Issue.year==year)):
        raise HTTPException(409,'Số phát hành này đã tồn tại trong năm đã chọn.')
    # Preserve the slug so existing links keep working after metadata corrections.
    apply_changes(o,changes,required={'number','month','year','title'})
    try: db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,'Số phát hành này đã tồn tại trong năm đã chọn.')
    db.refresh(o)
    return issue_json(o)


@admin.post('/issues/{issue_id}/publish')
def publish_issue(issue_id:str,db:Session=Depends(get_db),user:User=Depends(require_admin)):
    o=db.scalar(select(Issue).where(Issue.id==issue_id).options(selectinload(Issue.articles),selectinload(Issue.sections)))
    if not o: raise HTTPException(404,'Không tìm thấy số.')
    if not o.pdf_key or not o.articles or not o.sections:
        raise HTTPException(422,'Thiếu PDF, chuyên mục hoặc danh sách bài viết.')
    if not (Path(settings().media_root)/o.pdf_key).is_file():
        raise HTTPException(422,'Không tìm thấy file PDF.')
    section_ids={s.id for s in o.sections}
    if any(a.section_id not in section_ids for a in o.articles):
        raise HTTPException(422,'Mỗi bài viết phải thuộc một chuyên mục của số này.')
    if any(a.pdf_page_start < 1 or a.pdf_page_end < a.pdf_page_start or a.pdf_page_end > o.page_count for a in o.articles):
        raise HTTPException(422,'Có bài viết có trang PDF nằm ngoài tài liệu. Vui lòng sửa trước khi xuất bản.')
    o.status='published';o.published_at=utc_now()
    # Only promote drafts: articles an editor deliberately set to another status keep it.
    for article in o.articles:
        if article.status=='draft': article.status='published'
    db.add(AuditLog(actor_id=user.id,action='publish_issue',target_id=issue_id))
    db.commit()
    return {'ok':True,'slug':o.slug,'unverified_articles':sum(1 for a in o.articles if not a.full_text_verified)}


@admin.post('/issues/{issue_id}/unpublish')
def unpublish_issue(issue_id:str,db:Session=Depends(get_db),user:User=Depends(require_admin)):
    o=db.get(Issue,issue_id)
    if not o: raise HTTPException(404,'Không tìm thấy số.')
    # Public queries all require the issue to be published, so per-article status is left untouched.
    o.status='draft';o.published_at=None
    db.add(AuditLog(actor_id=user.id,action='unpublish_issue',target_id=issue_id))
    db.commit()
    return {'ok':True}


@admin.get('/articles/{article_id}')
def admin_article(article_id:str,db:Session=Depends(get_db),user:User=Depends(require_editor)):
    a=db.scalar(select(Article).where(Article.id==article_id).options(selectinload(Article.issue),selectinload(Article.section)))
    if not a: raise HTTPException(404,'Không tìm thấy bài viết.')
    return article_json(a,True,True)


class ArticlePatch(BaseModel):
    title: str | None = Field(default=None,min_length=2,max_length=1000)
    author_display: str | None = Field(default=None,max_length=400)
    summary: str | None = None
    body_html: str | None = None
    full_text_verified: bool | None = None
    print_page_start: int | None = Field(default=None,ge=1)
    print_page_end: int | None = Field(default=None,ge=1)
    pdf_page_start: int | None = Field(default=None,ge=1)
    pdf_page_end: int | None = Field(default=None,ge=1)
    section_id: str | None = None


SAFE_TAGS = ['p','br','b','strong','i','em','u','h2','h3','h4','ul','ol','li','blockquote','a','figure','figcaption','img','table','thead','tbody','tr','th','td','sup','sub']
SAFE_ATTRS = {'a':['href','title'],'img':['src','alt','title'],'th':['colspan','rowspan'],'td':['colspan','rowspan']}


@admin.patch('/articles/{article_id}')
def patch_article(article_id:str,body:ArticlePatch,db:Session=Depends(get_db),user:User=Depends(require_editor)):
    a=db.get(Article,article_id)
    if not a: raise HTTPException(404,'Không tìm thấy bài viết.')
    changes=body.model_dump(exclude_unset=True)
    if changes.get('section_id') is not None:
        section=db.get(Section,changes['section_id'])
        if not section or section.issue_id != a.issue_id:
            raise HTTPException(422,'Chuyên mục không thuộc số đặc san này.')
    if 'body_html' in changes and changes['body_html'] is not None:
        changes['body_html']=bleach.clean(changes['body_html'], tags=SAFE_TAGS,attributes=SAFE_ATTRS,protocols=['http','https'], strip=True)
    apply_changes(a,changes,required={'title','print_page_start','print_page_end','pdf_page_start','pdf_page_end','full_text_verified'},nullable={'section_id'})
    if a.full_text_verified and not a.body_html.strip():
        raise HTTPException(422,'Không thể đánh dấu đã hiệu đính khi toàn văn còn trống.')
    if a.print_page_end < a.print_page_start:
        raise HTTPException(422,'Trang kết thúc phải lớn hơn hoặc bằng trang bắt đầu.')
    if a.pdf_page_end < a.pdf_page_start:
        raise HTTPException(422,'Trang PDF kết thúc phải lớn hơn hoặc bằng trang bắt đầu.')
    if a.issue.page_count and a.pdf_page_end > a.issue.page_count:
        raise HTTPException(422,'Trang PDF vượt quá số trang của tài liệu.')
    db.add(AuditLog(actor_id=user.id,action='update_article',target_id=article_id))
    db.commit();db.refresh(a)
    return {'ok':True,'id':a.id}


@admin.post('/issues/import-pdf',status_code=202)
async def upload_pdf(file:UploadFile=File(...),db:Session=Depends(get_db),user:User=Depends(require_editor)):
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400,'Chỉ hỗ trợ PDF.')
    root=Path(settings().media_root)/'imports';root.mkdir(parents=True,exist_ok=True)
    key=f'imports/{uuid4()}.pdf'; dest=Path(settings().media_root)/key
    count=0
    with dest.open('wb') as f:
        while chunk:=await file.read(1024*1024):
            count+=len(chunk)
            if count>60*1024*1024:
                f.close();dest.unlink(missing_ok=True);raise HTTPException(413,'PDF vượt quá 60 MB.')
            f.write(chunk)
    with dest.open('rb') as f:
        if f.read(5)!=b'%PDF-':
            dest.unlink(missing_ok=True);raise HTTPException(400,'Tệp không phải PDF hợp lệ.')
    job=ImportJob(filename=Path(file.filename).name[:400], storage_key=key, status='uploaded', message='Đang chờ xử lý')
    db.add(job);db.commit();db.refresh(job)
    from app.tasks import process_pdf_import
    try:process_pdf_import.delay(job.id)
    except Exception:
        job.status='failed';job.message='Không kết nối được worker/Redis.';db.commit()
        raise HTTPException(503,'Không thể gửi tác vụ vào worker.')
    return {'id':job.id,'status':job.status}


@admin.get('/import-jobs')
def list_imports(db:Session=Depends(get_db),user:User=Depends(require_editor)):
    jobs=db.scalars(select(ImportJob).order_by(ImportJob.created_at.desc()).limit(30)).all()
    return [dict(id=j.id, filename=j.filename,status=j.status,progress=j.progress,message=j.message,issue_id=j.issue_id) for j in jobs]


@admin.get('/import-jobs/{job_id}')
def get_import(job_id:str,db:Session=Depends(get_db),user:User=Depends(require_editor)):
    j=db.get(ImportJob,job_id)
    if not j: raise HTTPException(404,'Không tìm thấy tác vụ.')
    return dict(id=j.id,filename=j.filename,status=j.status,progress=j.progress,message=j.message,issue_id=j.issue_id)


class SectionCreate(BaseModel):
    name: str = Field(min_length=2,max_length=300)


@admin.post('/issues/{issue_id}/sections',status_code=201)
def create_section(issue_id:str,body:SectionCreate,db:Session=Depends(get_db),user:User=Depends(require_editor)):
    issue=db.get(Issue,issue_id)
    if not issue:raise HTTPException(404,'Không tìm thấy số.')
    section_slug=slugify(body.name)
    existing=db.scalar(select(Section.id).where(Section.issue_id==issue_id,Section.slug==section_slug))
    if existing:raise HTTPException(409,'Chuyên mục đã tồn tại trong số này.')
    order=db.scalar(select(func.count()).select_from(Section).where(Section.issue_id==issue_id)) or 0
    section=Section(issue_id=issue_id,name=body.name,slug=section_slug,sort_order=order)
    db.add(section);db.commit();db.refresh(section)
    return {'id':section.id,'name':section.name}


class ArticleCreate(BaseModel):
    title: str = Field(min_length=2,max_length=1000)
    author_display: str = Field(default='',max_length=400)
    section_id: str
    print_page_start: int = Field(default=1,ge=1)
    print_page_end: int = Field(default=1,ge=1)
    pdf_page_start: int | None = Field(default=None,ge=1)
    pdf_page_end: int | None = Field(default=None,ge=1)


@admin.post('/issues/{issue_id}/articles',status_code=201)
def create_article(issue_id:str,body:ArticleCreate,db:Session=Depends(get_db),user:User=Depends(require_editor)):
    issue=db.get(Issue,issue_id)
    if not issue:raise HTTPException(404,'Không tìm thấy số.')
    section=db.get(Section,body.section_id)
    if not section or section.issue_id != issue_id:raise HTTPException(422,'Chuyên mục không hợp lệ.')
    if body.print_page_end<body.print_page_start:raise HTTPException(422,'Số trang không hợp lệ.')
    pdf_start=body.pdf_page_start or body.print_page_start
    pdf_end=body.pdf_page_end or body.print_page_end
    if pdf_end < pdf_start or (issue.page_count and pdf_end > issue.page_count):
        raise HTTPException(422,'Khoảng trang PDF không hợp lệ hoặc vượt quá tài liệu.')
    order=db.scalar(select(func.count()).select_from(Article).where(Article.issue_id==issue_id)) or 0
    article=Article(issue_id=issue_id,section_id=body.section_id,title=body.title,
      author_display=body.author_display,slug=f'{slugify(body.title)}-{issue.slug}-{uuid4().hex[:8]}',
      print_page_start=body.print_page_start,print_page_end=body.print_page_end,
      pdf_page_start=pdf_start,pdf_page_end=pdf_end,
      sort_order=order,status='draft')
    db.add(article);db.commit();db.refresh(article)
    return {'id':article.id,'slug':article.slug}


@admin.post('/issues/{issue_id}/pdf')
async def attach_pdf(issue_id:str,file:UploadFile=File(...),db:Session=Depends(get_db),user:User=Depends(require_editor)):
    issue=db.get(Issue,issue_id)
    if not issue:raise HTTPException(404,'Không tìm thấy số.')
    if issue.status=='published':
        raise HTTPException(409,'Hãy thu hồi xuất bản trước khi thay PDF để kiểm tra lại mục lục và số trang.')
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(422,'Chỉ hỗ trợ file PDF.')
    root=Path(settings().media_root);(root/'issues').mkdir(parents=True,exist_ok=True)
    key=f'issues/manual-{uuid4().hex}.pdf';dest=root/key
    total=0
    with dest.open('wb') as f:
        while chunk:=await file.read(1024*1024):
            total+=len(chunk)
            if total>60*1024*1024:
                f.close();dest.unlink(missing_ok=True);raise HTTPException(413,'PDF vượt quá 60 MB.')
            f.write(chunk)
    with dest.open('rb') as f:
        if f.read(5)!=b'%PDF-':
            dest.unlink(missing_ok=True);raise HTTPException(422,'PDF không hợp lệ.')
    import fitz
    try:
        with fitz.open(dest) as doc:
            issue.page_count=len(doc)
            cover_key=f'covers/manual-{uuid4().hex}.png'
            (root/'covers').mkdir(parents=True,exist_ok=True)
            doc[0].get_pixmap(matrix=fitz.Matrix(1,1)).save(str(root/cover_key))
            issue.cover_key=cover_key
    except Exception:
        dest.unlink(missing_ok=True);raise HTTPException(422,'Không thể đọc file PDF.')
    if issue.pdf_key:
        for article in issue.articles: article.full_text_verified=False
    issue.pdf_key=key
    db.commit()
    return {'ok':True,'pdf_key':key,'page_count':issue.page_count}
