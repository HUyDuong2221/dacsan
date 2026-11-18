from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://dacsan:dacsan@db:5432/dacsan"
    jwt_secret: str = "change-me-in-production"
    jwt_hours: int = 12
    admin_email: str = "admin@example.com"
    admin_password: str = "admin12345"
    media_dir: str = "/data/media"
    max_upload_mb: int = 50
    seed_demo: bool = True


settings = Settings()
