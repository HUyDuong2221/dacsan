from pathlib import Path

import fitz
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import hasher
from app.core import Base, get_db, settings
from app.main import app
from app.models import User


@pytest.fixture
def editorial_client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings(), 'media_root', str(tmp_path))
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
        with TestClient(app) as client:
            login(client, 'admin')
            yield client
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def login(client, role):
    response = client.post('/api/v1/auth/login', json={'email': f'{role}@test.local', 'password': 'TestOnly123!'})
    assert response.status_code == 200
    client.headers['X-CSRF-Token'] = client.cookies.get('dacsan_csrf')


def create_issue(client, number=19, month=11):
    response = client.post('/api/v1/admin/issues', json={'number': number, 'month': month, 'year': 2026, 'title': 'Editorial test issue'})
    assert response.status_code == 201, response.text
    return response.json()


def attach_pdf(client, issue_id):
    with fitz.open() as doc:
        for index in range(3):
            page = doc.new_page()
            page.insert_text((72, 72), f'Sample page {index + 1}')
        data = doc.tobytes()
    return client.post(f'/api/v1/admin/issues/{issue_id}/pdf', files={'file': ('sample.pdf', data, 'application/pdf')})


def create_section(client, issue_id):
    response = client.post(f'/api/v1/admin/issues/{issue_id}/sections', json={'name': 'Research'})
    assert response.status_code == 201
    return response.json()['id']


def article_body(section_id):
    return {'title': 'Research article', 'section_id': section_id, 'print_page_start': 10, 'print_page_end': 11, 'pdf_page_start': 2, 'pdf_page_end': 3}


def test_manual_creation_publication_and_withdrawal(editorial_client):
    client = editorial_client
    issue = create_issue(client)
    base = f"/api/v1/admin/issues/{issue['id']}"
    assert client.post(base + '/publish').status_code == 422
    assert attach_pdf(client, issue['id']).status_code == 200
    section = create_section(client, issue['id'])
    body = article_body(section)
    created = client.post(base + '/articles', json=body)
    assert created.status_code == 201
    article_id = created.json()['id']
    assert client.get(f"/api/v1/issues/{issue['slug']}").status_code == 404
    assert client.post(base + '/articles', json={**body, 'pdf_page_end': 4}).status_code == 422
    assert client.patch(f'/api/v1/admin/articles/{article_id}', json={'pdf_page_start': 3, 'pdf_page_end': 2}).status_code == 422
    assert client.patch(f'/api/v1/admin/articles/{article_id}', json={'body_html': '<p>Verified article</p>', 'full_text_verified': True}).status_code == 200
    assert client.post(base + '/publish').status_code == 200
    public = client.get(f"/api/v1/issues/{issue['slug']}").json()
    assert public['sections'][0]['articles'][0]['pdf_page_start'] == 2
    assert public['sections'][0]['articles'][0]['print_page_start'] == 10
    # Draft additions must remain visible to the editor, but not to public readers.
    assert client.post(base + '/articles', json={**body, 'title': 'Draft addition'}).status_code == 201
    assert len(client.get(base).json()['sections'][0]['articles']) == 2
    assert len(client.get(f"/api/v1/issues/{issue['slug']}").json()['sections'][0]['articles']) == 1
    assert attach_pdf(client, issue['id']).status_code == 409
    login(client, 'editor')
    assert client.post(base + '/unpublish').status_code == 403
    assert client.post(base + '/publish').status_code == 403
    login(client, 'admin')
    assert client.post(base + '/unpublish').status_code == 200
    assert client.get(f"/api/v1/issues/{issue['slug']}").status_code == 404
    detail = client.get(base).json()
    assert detail['status'] == 'draft'
    assert [a['status'] for a in detail['sections'][0]['articles']] == ['published', 'draft']  # unpublish keeps per-article status
    assert attach_pdf(client, issue['id']).status_code == 200
    assert not client.get(f'/api/v1/admin/articles/{article_id}').json()['full_text_verified']
    # PATCH null semantics: required fields reject null, optional text can be cleared.
    assert client.patch(f'/api/v1/admin/articles/{article_id}', json={'title': None}).status_code == 422
    assert client.patch(f'/api/v1/admin/articles/{article_id}', json={'summary': 'x'}).status_code == 200
    assert client.patch(f'/api/v1/admin/articles/{article_id}', json={'summary': None}).status_code == 200
    assert client.get(f'/api/v1/admin/articles/{article_id}').json()['summary'] == ''
    assert client.patch(f'/api/v1/admin/articles/{article_id}', json={'section_id': None}).status_code == 200
    assert client.patch(base, json={'title': None}).status_code == 422


def test_issue_identity_and_article_section_validation(editorial_client):
    client = editorial_client
    issue = create_issue(client)
    base = f"/api/v1/admin/issues/{issue['id']}"
    duplicate = client.post('/api/v1/admin/issues', json={'number': 19, 'month': 12, 'year': 2026, 'title': 'Duplicate issue'})
    assert duplicate.status_code == 409
    other = create_issue(client, number=20)
    assert client.patch(base, json={'number': 20}).status_code == 409
    corrected = client.patch(base, json={'month': 12, 'title': 'Corrected issue'}).json()
    assert corrected['month'] == 12 and corrected['slug'] == issue['slug']
    section = create_section(client, issue['id'])
    other_section = create_section(client, other['id'])
    article = client.post(base + '/articles', json=article_body(section)).json()
    assert client.patch(f"/api/v1/admin/articles/{article['id']}", json={'section_id': other_section}).status_code == 422
    # Page ranges entered before attaching a PDF must still be checked at publication.
    assert attach_pdf(client, issue['id']).status_code == 200
    file_path = Path(settings().media_root) / client.get(base).json()['pdf_key']
    file_path.unlink()
    assert client.post(base + '/publish').status_code == 422
