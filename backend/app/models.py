from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Stamped:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="admin")  # admin | editor | contributor
    full_name: Mapped[str] = mapped_column(String(200), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Field(Base):
    """Chuyên mục."""

    __tablename__ = "fields"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Issue(Stamped, Base):
    """Số phát hành."""

    __tablename__ = "issues"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    number: Mapped[int] = mapped_column(Integer, unique=True)
    label: Mapped[str] = mapped_column(String(80))  # "Số 17 (6-2026)"
    year: Mapped[int] = mapped_column(Integer, default=2026)
    published_at: Mapped[date | None] = mapped_column(Date, nullable=True)  # Ngày đăng
    title: Mapped[str | None] = mapped_column(String(400), nullable=True)  # Tên số đặc san (hiện ở khối Tiêu điểm)
    theme: Mapped[str] = mapped_column(String(400))
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    printed_articles: Mapped[int | None] = mapped_column(Integer, nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)  # tiêu điểm trên trang chủ

    entries: Mapped[list["TocEntry"]] = relationship(
        back_populates="issue", cascade="all, delete-orphan", passive_deletes=True
    )


class TocEntry(Stamped, Base):
    """Một dòng trong mục lục của số đặc san. Toàn văn (lead/body) là tùy chọn; không có thì hiện "chỉ có bản in"."""

    __tablename__ = "toc_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(300), unique=True, index=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    field_id: Mapped[int | None] = mapped_column(ForeignKey("fields.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(600))
    author: Mapped[str] = mapped_column(String(300), default="")
    page_label: Mapped[str] = mapped_column(String(40), default="")
    lead: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Nội dung dạng markdown-lite: "## Đề mục", đoạn cách nhau dòng trống, "![chú thích](url)"
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_front: Mapped[bool] = mapped_column(Boolean, default=False)  # trang đầu số
    is_research: Mapped[bool] = mapped_column(Boolean, default=False)  # Nghiên cứu – Trao đổi
    featured: Mapped[bool] = mapped_column(Boolean, default=False)  # hero slide
    hero_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)

    issue: Mapped[Issue] = relationship(back_populates="entries", lazy="joined")
    field: Mapped[Field | None] = relationship(lazy="joined")


class ActivityType(Base):
    """Loại hoạt động (chọn được trong mục Hoạt động; Activity.kind lưu tên loại)."""

    __tablename__ = "activity_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Activity(Stamped, Base):
    __tablename__ = "activities"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(600))
    kind: Mapped[str] = mapped_column(String(200), default="")
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)  # HTML từ CKEditor 5
    attachment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)  # tệp đính kèm (Word, PDF...)
    published: Mapped[bool] = mapped_column(Boolean, default=True)


class Notice(Stamped, Base):
    __tablename__ = "notices"
    id: Mapped[int] = mapped_column(primary_key=True)
    tag: Mapped[str] = mapped_column(String(60), default="THÔNG BÁO")
    title: Mapped[str] = mapped_column(String(600))
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    notice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=True)


class Document(Stamped, Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(600))
    doc_type: Mapped[str] = mapped_column(String(60), default="")
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    published: Mapped[bool] = mapped_column(Boolean, default=True)


SUBMISSION_STATUSES = {
    "new": "Mới nhận",
    "reviewing": "Đang xét duyệt",
    "revision": "Cần chỉnh sửa",
    "accepted": "Đã nhận đăng",
    "rejected": "Không phù hợp",
}


class Submission(Stamped, Base):
    """Bài gửi cho Đặc san từ người ngoài (chưa phải mục lục)."""

    __tablename__ = "submissions"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)  # mã tra cứu của tác giả
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255), index=True)
    organization: Mapped[str] = mapped_column(String(300), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    field_name: Mapped[str] = mapped_column(String(200), default="")  # chuyên mục đề xuất
    title: Mapped[str] = mapped_column(String(600))
    abstract: Mapped[str] = mapped_column(Text)
    file_path: Mapped[str] = mapped_column(String(100))  # tên tệp trong private_dir
    file_name: Mapped[str] = mapped_column(String(300))  # tên tệp gốc
    status: Mapped[str] = mapped_column(String(20), default="new")
    note_public: Mapped[str | None] = mapped_column(Text, nullable=True)  # tác giả thấy khi tra cứu
    note_internal: Mapped[str | None] = mapped_column(Text, nullable=True)  # chỉ ban biên tập


class Subscriber(Base):
    __tablename__ = "subscribers"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Setting(Base):
    """Cấu hình site dạng key/value (footer, lãnh đạo, giấy phép...)."""

    __tablename__ = "settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True)
    value: Mapped[str] = mapped_column(Text, default="")
