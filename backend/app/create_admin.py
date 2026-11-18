"""Create the first administrator from ADMIN_EMAIL / ADMIN_PASSWORD if no admin exists yet.

Unlike app.seed this never imports demo issues, so it is safe to run on every production start.
"""
from sqlalchemy import select
from app.auth import hasher
from app.core import SessionLocal, settings
from app.models import User


def main() -> None:
    cfg = settings()
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.role == 'admin').limit(1)):
            print('Admin account already exists; nothing to do.')
            return
        email = cfg.admin_email.strip().lower()
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            existing.role = 'admin'
            existing.is_active = True
        else:
            db.add(User(email=email, password_hash=hasher.hash(cfg.admin_password), role='admin'))
        db.commit()
        print(f'Created admin account: {email}')


if __name__ == '__main__':
    main()
