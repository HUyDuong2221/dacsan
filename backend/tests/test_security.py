import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app import auth
from app.auth import hasher
from app.core import Base, Settings, get_db, settings
from app.main import app
from app.models import Issue, User


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings(), 'media_root', str(tmp_path))
    auth._login_failures.clear()
    engine = create_engine('sqlite+pysqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(engine, expire_on_commit=False)
    with sessions() as db:
        db.add(User(email='ed@test.local', password_hash=hasher.hash('TestOnly123!'), role='editor'))
        db.add(Issue(number=1, month=1, year=2026, slug='pub', title='P', status='published', pdf_key='issues/pub.pdf', cover_key='covers/pub.png'))
        db.add(Issue(number=2, month=2, year=2026, slug='draft', title='D', status='draft', pdf_key='issues/draft.pdf'))
        db.commit()
    for name in ('issues/pub.pdf', 'covers/pub.png', 'issues/draft.pdf', 'imports/raw.pdf'):
        f = tmp_path / name
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(b'%PDF-1.4 test')

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


def test_media_only_for_published(client):
    assert client.get('/media/issues/pub.pdf').status_code == 200
    assert client.get('/media/covers/pub.png').status_code == 200
    assert client.get('/media/issues/draft.pdf').status_code == 404
    assert client.get('/media/imports/raw.pdf').status_code == 404
    assert client.get('/media/../.env').status_code == 404
    assert client.get('/media/%2e%2e/%2e%2e/etc/passwd').status_code == 404


def test_editor_can_read_draft_media(client):
    assert client.post('/api/v1/auth/login', json={'email': 'ed@test.local', 'password': 'TestOnly123!'}).status_code == 200
    assert client.get('/media/issues/draft.pdf').status_code == 200


def test_login_rate_limit(client):
    for _ in range(auth.MAX_LOGIN_FAILURES):
        assert client.post('/api/v1/auth/login', json={'email': 'ed@test.local', 'password': 'bad'}).status_code == 401
    assert client.post('/api/v1/auth/login', json={'email': 'ed@test.local', 'password': 'TestOnly123!'}).status_code == 429


def test_production_rejects_default_secrets():
    with pytest.raises(ValueError):
        Settings(environment='production')
    ok = Settings(environment='production', secret_key='x' * 48, admin_password='A-long-strong-pass-1',
                  database_url='postgresql+psycopg://u:strongpw@db/x', cookie_secure=True)
    assert ok.environment == 'production'
