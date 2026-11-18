from functools import lru_cache
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str = 'postgresql+psycopg://dacsan:local_dev_password_change_me@localhost:5432/dacsan'
    secret_key: str = 'local_development_only_replace_with_64_random_chars'
    admin_email: str = 'admin@example.local'
    admin_password: str = 'ChangeMe123!'
    media_root: str = '/app/media'
    cors_origins: str = 'http://localhost:3000'
    celery_broker_url: str = 'redis://redis:6379/0'
    celery_result_backend: str = 'redis://redis:6379/1'
    cookie_secure: bool = False
    environment: str = 'development'

    @model_validator(mode='after')
    def refuse_insecure_production(self):
        if self.environment.lower() != 'production':
            return self
        problems = []
        if self.secret_key.startswith('local_development') or len(self.secret_key) < 32:
            problems.append('SECRET_KEY phải là chuỗi ngẫu nhiên dài từ 32 ký tự')
        if self.admin_password == 'ChangeMe123!' or len(self.admin_password) < 12:
            problems.append('ADMIN_PASSWORD không được dùng giá trị mặc định và phải từ 12 ký tự')
        if 'local_dev_password' in self.database_url:
            problems.append('DATABASE_URL đang dùng mật khẩu mặc định')
        if not self.cookie_secure:
            problems.append('COOKIE_SECURE phải bật (true) khi chạy production')
        if problems:
            raise ValueError('Cấu hình production không an toàn: ' + '; '.join(problems))
        return self


@lru_cache

def settings():
    return Settings()


engine = create_engine(settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
