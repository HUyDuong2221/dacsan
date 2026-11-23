from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://dacsan:dacsan@db:5432/dacsan"
    jwt_secret: str = "change-me-in-production"
    jwt_hours: int = 12
    admin_email: str = "admin@example.com"
    admin_password: str = "admin12345"
    media_dir: str = "/data/media"
    private_dir: str = "/data/private"  # bản thảo gửi về: KHÔNG công khai
    max_submission_mb: int = 20
    max_upload_mb: int = 50
    seed_demo: bool = True
    # Số proxy tin cậy phía trước backend có ghi IP vào X-Forwarded-For (Next.js rewrite / nginx). 0 = bỏ qua header.
    forwarded_hops: int = 1
    # Email (SMTP). Để trống smtp_host thì thư chỉ lưu ở Hộp thư đi, không gửi.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""  # địa chỉ gửi, ví dụ dacsan@lhh.danang.gov.vn
    smtp_security: str = "starttls"  # starttls | ssl | none
    # Địa chỉ website công khai, dùng tạo link trong email (đặt lại mật khẩu, hủy đăng ký...)
    site_url: str = "http://localhost:3000"
    # Quét mã độc tệp tải lên bằng ClamAV (clamd). Để trống clamav_host thì không quét.
    clamav_host: str = ""
    clamav_port: int = 3310
    clamav_fail_open: bool = False  # máy quét lỗi/chưa sẵn sàng: false = từ chối tệp (an toàn), true = vẫn nhận
    # Sao lưu: thư mục chứa bản sao lưu do container backup tạo (volume backups)
    backup_dir: str = "/backups"


settings = Settings()
