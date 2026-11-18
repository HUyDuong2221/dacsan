"""Idempotent seed for local demo. Not a general-purpose publisher."""
from pathlib import Path
from sqlalchemy import select
from app.core import SessionLocal, settings
from app.auth import hasher
from app.models import User
from app.importer import import_pdf


def main():
    with SessionLocal() as db:
        email=settings().admin_email.strip().lower()
        if not db.scalar(select(User).where(User.email==email)):
            db.add(User(email=email, password_hash=hasher.hash(settings().admin_password),role='admin'))
            db.commit();print('Created demo admin:',email)
        source=Path('/app/sample/KHPT_2-11.pdf')
        if not source.exists():
            source=Path(__file__).resolve().parents[2]/'sample'/'KHPT_2-11.pdf'
        if source.exists():
            issue=import_pdf(db,source,publish_sample=True)
            print(f'Seeded or found issue {issue.slug} ({issue.page_count} PDF pages)')
        else:
            print('No sample PDF found; skipping sample issue')


if __name__=='__main__': main()
