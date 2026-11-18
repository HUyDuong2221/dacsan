from pathlib import Path
from types import SimpleNamespace
import fitz
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.core import Base
from app.models import Issue
import app.importer as importer

PROJECT=Path(__file__).resolve().parents[1]
SAMPLE=(PROJECT/'sample'/'KHPT_2-11.pdf') if (PROJECT/'sample'/'KHPT_2-11.pdf').exists() else PROJECT.parent/'sample'/'KHPT_2-11.pdf'


def test_sample_toc():
    with fitz.open(SAMPLE) as doc:
        rows=importer.parse_toc(doc)
        assert len(doc)==136
        assert len(rows)==24
        assert len({r['section'] for r in rows})==6
        assert rows[0]['page']==5
        assert rows[3]['page']==15
        assert rows[-1]['page']==124


def test_idempotent_import(tmp_path,monkeypatch):
    monkeypatch.setattr(importer,'settings',lambda:SimpleNamespace(media_root=str(tmp_path/'media')))
    engine=create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        one=importer.import_pdf(session,SAMPLE,publish_sample=True)
        two=importer.import_pdf(session,SAMPLE,publish_sample=True)
        assert one.id==two.id
        assert session.query(Issue).count()==1
        assert len(one.sections)==6
        assert len(one.articles)==24
        assert all(not a.full_text_verified for a in one.articles)
        assert (tmp_path/'media'/one.pdf_key).exists()
        assert (tmp_path/'media'/one.cover_key).exists()
