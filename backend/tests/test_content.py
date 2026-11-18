import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app import auth
from app.auth import hasher
from app.core import Base, get_db, settings
from app.main import app
from app.models import User

API = '/api/v1'


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setattr(settings(), 'media_root', str(tmp_path))
    auth._login_failures.clear()
    engine = create_engine('sqlite+pysqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(engine, expire_on_commit=False)
    with sessions() as db:
        for role in ('admin', 'editor'):
            db.add(User(email=f'{role}@test.local', password_hash=hasher.hash('TestOnly123!'), role=role))
        db.commit()

    def override():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def login(client, role):
    r = client.post(f'{API}/auth/login', json={'email': f'{role}@test.local', 'password': 'TestOnly123!'})
    assert r.status_code == 200
    client.headers['X-CSRF-Token'] = client.cookies.get('dacsan_csrf', '')


def test_document_lifecycle(env):
    c = env
    login(c, 'editor')
    d = c.post(f'{API}/admin/documents', json={'title': 'Quy định xuất bản', 'doc_type': 'QUY ĐỊNH'}).json()
    assert c.get(f'{API}/documents').json()['items'] == []
    assert c.post(f'{API}/admin/documents/{d["id"]}/publish').status_code == 403  # editor cannot publish
    assert c.post(f'{API}/admin/documents', json={'title': 'Bad', 'external_url': 'javascript:alert(1)'}).status_code == 422
    # wrong extension / content mismatch are rejected
    assert c.post(f'{API}/admin/documents/{d["id"]}/file', files={'file': ('x.exe', b'MZ', 'application/octet-stream')}).status_code == 422
    assert c.post(f'{API}/admin/documents/{d["id"]}/file', files={'file': ('x.pdf', b'not a pdf', 'application/pdf')}).status_code == 422
    r = c.post(f'{API}/admin/documents/{d["id"]}/file', files={'file': ('quy-dinh.pdf', b'%PDF-1.4 hello', 'application/pdf')})
    assert r.status_code == 200
    key = r.json()['file_key']
    assert c.get(f'/media/{key}').status_code == 200  # editors may read drafts
    login(c, 'admin')
    assert c.post(f'{API}/admin/documents/{d["id"]}/publish').status_code == 200
    c.cookies.clear()
    c.headers.pop('X-CSRF-Token', None)
    listing = c.get(f'{API}/documents').json()
    assert [x['title'] for x in listing['items']] == ['Quy định xuất bản'] and listing['types'] == ['QUY ĐỊNH']
    assert c.get(f'/media/{key}').status_code == 200  # public once published
    assert c.get(f'{API}/documents', params={'doc_type': 'KHÁC'}).json()['items'] == []
    login(c, 'admin')
    assert c.post(f'{API}/admin/documents/{d["id"]}/unpublish').status_code == 200
    c.cookies.clear()
    assert c.get(f'/media/{key}').status_code == 404
    login(c, 'admin')
    assert c.delete(f'{API}/admin/documents/{d["id"]}').status_code == 200
    assert c.get(f'{API}/admin/documents').json() == []


def test_document_publish_requires_file_or_link(env):
    c = env
    login(c, 'admin')
    d = c.post(f'{API}/admin/documents', json={'title': 'Chưa có tệp'}).json()
    assert c.post(f'{API}/admin/documents/{d["id"]}/publish').status_code == 422
    assert c.patch(f'{API}/admin/documents/{d["id"]}', json={'external_url': 'https://example.org/a.pdf'}).status_code == 200
    assert c.post(f'{API}/admin/documents/{d["id"]}/publish').status_code == 200
    assert c.patch(f'{API}/admin/documents/{d["id"]}', json={'external_url': None}).status_code == 422  # would leave published doc empty


def test_notice_lifecycle_and_sanitizing(env):
    c = env
    login(c, 'editor')
    n = c.post(f'{API}/admin/notices', json={'title': 'Thư mời viết bài số 18', 'tag': 'THƯ MỜI', 'summary': 'Mời gửi bài',
               'body_html': '<p>Nội dung</p><script>alert(1)</script>', 'notice_date': '2026-09-08'}).json()
    assert '<script>' not in n['body_html']
    assert c.get(f'{API}/notices').json()['total'] == 0
    assert c.get(f'{API}/notices/{n["slug"]}').status_code == 404
    assert c.post(f'{API}/admin/notices/{n["id"]}/publish').status_code == 403
    login(c, 'admin')
    other = c.post(f'{API}/admin/notices', json={'title': 'Hội thi sáng tạo', 'summary': 'Phát động', 'notice_date': '2026-09-20'}).json()
    pinned = c.post(f'{API}/admin/notices', json={'title': 'Ghim', 'summary': 'Quan trọng', 'notice_date': '2026-01-01', 'is_pinned': True}).json()
    empty = c.post(f'{API}/admin/notices', json={'title': 'Rỗng'}).json()
    assert c.post(f'{API}/admin/notices/{empty["id"]}/publish').status_code == 422
    for x in (n, other, pinned):
        assert c.post(f'{API}/admin/notices/{x["id"]}/publish').status_code == 200
    c.cookies.clear()
    c.headers.pop('X-CSRF-Token', None)
    titles = [x['title'] for x in c.get(f'{API}/notices').json()['items']]
    assert titles == ['Ghim', 'Hội thi sáng tạo', 'Thư mời viết bài số 18']  # pinned first, then newest
    detail = c.get(f'{API}/notices/{n["slug"]}').json()
    assert detail['body_html'] == '<p>Nội dung</p>alert(1)'
    login(c, 'admin')
    assert c.patch(f'{API}/admin/notices/{n["id"]}', json={'title': None}).status_code == 422
    assert c.delete(f'{API}/admin/notices/{n["id"]}').status_code == 200
    assert c.get(f'{API}/notices/{n["slug"]}').status_code == 404
