from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from app.auth import hasher
from app.core import Base, get_db
from app.main import app
from app.models import User,Issue,Section,Article


def test_public_and_editorial_workflows():
    engine=create_engine('sqlite+pysqlite:///:memory:',connect_args={'check_same_thread':False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    TestSession=sessionmaker(engine,expire_on_commit=False)
    with TestSession() as db:
        user=User(email='admin@test.local',password_hash=hasher.hash('DemoTest123!'),role='admin')
        issue=Issue(number=42,month=1,year=2026,slug='so-42-1-2026',title='Số kiểm thử',status='published',page_count=5)
        db.add_all([user,issue]);db.flush()
        section=Section(issue_id=issue.id,name='KHOA HỌC',slug='khoa-hoc',sort_order=0)
        db.add(section);db.flush()
        article=Article(issue_id=issue.id,section_id=section.id,title='Đề tài số hóa',slug='de-tai-so-hoa',author_display='Tác giả',status='published',raw_extracted_text='Nội dung chưa duyệt',full_text_verified=False,print_page_start=2,print_page_end=5,pdf_page_start=2,pdf_page_end=5)
        db.add(article);db.commit();article_id=article.id

    def override():
        db=TestSession()
        try:yield db
        finally:db.close()

    app.dependency_overrides[get_db]=override
    try:
        with TestClient(app) as client:
            r=client.get('/api/v1/issues/so-42-1-2026')
            assert r.status_code==200 and len(r.json()['sections'])==1
            r=client.get('/api/v1/articles/de-tai-so-hoa')
            assert r.status_code==200 and not r.json()['body_html']
            r=client.get('/api/v1/admin/dashboard')
            assert r.status_code==401
            assert client.post('/api/v1/auth/login',json={'email':'admin@test.local','password':'bad'}).status_code==401
            r=client.post('/api/v1/auth/login',json={'email':'admin@test.local','password':'DemoTest123!'})
            assert r.status_code==200
            assert client.patch(f'/api/v1/admin/articles/{article_id}',json={'body_html':'<p>Đã đối chiếu.</p>','full_text_verified':True}).status_code==403
            csrf=client.cookies.get('dacsan_csrf','')
            r=client.patch(f'/api/v1/admin/articles/{article_id}',headers={'X-CSRF-Token':csrf},json={'body_html':'<p>Đã đối chiếu.</p>','full_text_verified':True})
            assert r.status_code==200
            r=client.get('/api/v1/articles/de-tai-so-hoa')
            assert r.json()['body_html']=='<p>Đã đối chiếu.</p>'
    finally:
        app.dependency_overrides.clear()
