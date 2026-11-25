import secrets
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
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
    # tự đăng ký ở trang đăng nhập, chờ quản trị viên duyệt (cột thêm bằng Alembic 0007)
    pending: Mapped[bool] = mapped_column(Boolean, default=False)
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
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # đã gửi thư báo số mới (Alembic 0007)

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


# Thứ tự xử lý: Mới nhận → Đang xét duyệt → Phân công phản biện → Chấp nhận / Yêu cầu sửa / Từ chối → Đã nhận đăng.
# Giữ nguyên các mã cũ (dữ liệu đã có không phải đổi); "accepted" vẫn là trạng thái cuối "Đã nhận đăng".
SUBMISSION_STATUSES = {
    "new": "Mới nhận",
    "reviewing": "Đang xét duyệt",
    "in_review": "Phân công phản biện",
    "approved": "Chấp nhận",
    "revision": "Yêu cầu sửa",
    "rejected": "Từ chối",
    "accepted": "Đã nhận đăng",
}

# Trạng thái được phép chuyển tới từ mỗi trạng thái (quyết định biên tập).
SUBMISSION_TRANSITIONS = {
    "new": ["reviewing", "rejected"],
    "reviewing": ["in_review", "approved", "revision", "rejected"],
    "in_review": ["approved", "revision", "rejected", "reviewing"],
    "revision": ["reviewing", "rejected"],  # tác giả gửi bản sửa thì xét duyệt lại
    "approved": ["accepted", "revision"],
    "rejected": ["reviewing"],  # mở lại hồ sơ
    "accepted": [],
}

REVIEW_STATUSES = {
    "invited": "Đã mời",
    "accepted": "Nhận phản biện",
    "declined": "Từ chối phản biện",
    "submitted": "Đã nộp",
    "overdue": "Quá hạn",
}

# Khuyến nghị của phản biện viên (không chấm điểm).
REVIEW_RECOMMENDATIONS = {
    "accept": "Chấp nhận đăng",
    "minor": "Sửa nhỏ",
    "major": "Sửa lớn",
    "reject": "Từ chối",
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
    # Dòng mục lục tạo từ bài này bằng nút "Đưa vào mục lục" (cột thêm bằng Alembic 0003; xóa dòng mục lục thì về NULL)
    toc_entry_id: Mapped[int | None] = mapped_column(ForeignKey("toc_entries.id", ondelete="SET NULL"), nullable=True)

    toc_entry: Mapped["TocEntry | None"] = relationship(lazy="joined")
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="submission", cascade="all, delete-orphan", passive_deletes=True, order_by="Review.id"
    )
    history: Mapped[list["SubmissionHistory"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="SubmissionHistory.id"
    )


# Các bảng dưới đây do Alembic tạo (app/migrations), init_db() không create_all chúng.
ALEMBIC_INFO = {"alembic": True}


class Review(Stamped, Base):
    """Một lượt mời phản biện. Phản biện viên là người ngoài (không có tài khoản), vào bằng liên kết chứa token."""

    __tablename__ = "reviews"
    __table_args__ = {"info": ALEMBIC_INFO}
    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"), index=True)
    reviewer_name: Mapped[str] = mapped_column(String(200))
    reviewer_email: Mapped[str] = mapped_column(String(255))
    invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    due_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="invited")  # xem REVIEW_STATUSES
    recommendation: Mapped[str | None] = mapped_column(String(20), nullable=True)  # xem REVIEW_RECOMMENDATIONS
    form_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # comments_author, comments_editor
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # sha256 của token, không lưu token gốc
    reminder_count: Mapped[int] = mapped_column(Integer, default=0)
    last_reminded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    submission: Mapped[Submission] = relationship(back_populates="reviews")


class SubmissionHistory(Base):
    """Nhật ký đổi trạng thái (và các sự kiện như phân công, nhắc hạn) của một bài gửi."""

    __tablename__ = "submission_history"
    __table_args__ = {"info": ALEMBIC_INFO}
    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(Text, default="")
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User | None] = relationship(lazy="joined")


class AuditLog(Base):
    """Nhật ký hoạt động: mọi thao tác ghi trong trang quản trị (middleware app/audit.py) và đăng nhập."""

    __tablename__ = "audit_logs"
    __table_args__ = {"info": ALEMBIC_INFO}
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_email: Mapped[str] = mapped_column(String(255), default="")  # lưu lại email lúc thao tác (người dùng có thể bị xóa)
    action: Mapped[str] = mapped_column(String(40), index=True)  # create | update | delete | login | login_failed | ...
    entity: Mapped[str] = mapped_column(String(60), default="", index=True)  # đoạn đầu đường dẫn API: issues, users...
    entity_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    summary: Mapped[str] = mapped_column(String(500), default="")
    method: Mapped[str] = mapped_column(String(10), default="")
    path: Mapped[str] = mapped_column(String(300), default="")
    status_code: Mapped[int] = mapped_column(Integer, default=0)
    ip: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class Page(Stamped, Base):
    """Trang nội dung tĩnh: Giới thiệu, Ban biên tập, Hỏi đáp... hiển thị tại /trang/<slug>."""

    __tablename__ = "pages"
    __table_args__ = {"info": ALEMBIC_INFO}
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    content: Mapped[str | None] = mapped_column(Text, nullable=True)  # HTML từ CKEditor 5
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    published: Mapped[bool] = mapped_column(Boolean, default=True)


class Post(Stamped, Base):
    """Bài viết độc lập (không thuộc số đặc san nào), ví dụ tạo từ PDF ở công cụ "Tạo bài từ PDF"; hiển thị tại /bai-viet/<slug>.
    body là HTML do trình soạn thảo CKEditor 5 tạo ra (cùng cách với Activity.content và Page.content)."""

    __tablename__ = "posts"
    __table_args__ = {"info": ALEMBIC_INFO}
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(600))
    author: Mapped[str] = mapped_column(String(300), default="")
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=False)


# Vị trí đặt banner trên trang chủ (theo thứ tự từ trên xuống); frontend: lib/banners.ts
BANNER_POSITIONS = {
    "top": "Đầu trang, trên Tiêu điểm",
    "after_front": "Dưới Tiêu điểm / Số mới nhất",
    "before_topics": "Trên Chuyên mục",
    "before_acts": "Trên Tin hoạt động",
    "before_archive": "Trên Kho lưu trữ",
    "before_submit": "Cuối trang, trên Gửi bài",
}


class Banner(Stamped, Base):
    """Banner trang chủ. Các banner cùng vị trí hiện thành một slider; kích thước theo vị trí lưu ở Setting banner_layout."""

    __tablename__ = "banners"
    __table_args__ = {"info": ALEMBIC_INFO}
    id: Mapped[int] = mapped_column(primary_key=True)
    image_url: Mapped[str] = mapped_column(String(500))
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    alt: Mapped[str] = mapped_column(String(300), default="")
    position: Mapped[str] = mapped_column(String(30), default="top")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    published: Mapped[bool] = mapped_column(Boolean, default=True)


class ViewStat(Base):
    """Lượt xem/đọc/tải cộng dồn theo ngày (giờ Việt Nam). Không có khóa ngoại: xóa số/bài vẫn giữ số liệu cũ."""

    __tablename__ = "view_stats"
    __table_args__ = (
        UniqueConstraint("day", "kind", "target_type", "target_id", name="uq_view_stats_key"),
        {"info": ALEMBIC_INFO},
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    kind: Mapped[str] = mapped_column(String(10))  # view (mở trang) | read (mở trình đọc PDF) | download (tải PDF)
    target_type: Mapped[str] = mapped_column(String(10))  # issue | article
    target_id: Mapped[int] = mapped_column(Integer)
    count: Mapped[int] = mapped_column(Integer, default=0)


def _unsub_token() -> str:
    return secrets.token_urlsafe(24)


class Subscriber(Base):
    __tablename__ = "subscribers"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # xác nhận hai bước: chỉ người đã bấm link xác nhận mới nhận thư báo số mới (Alembic 0007)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, default=_unsub_token)  # link xác nhận / hủy


EMAIL_STATUSES = {"pending": "Đang chờ gửi", "sent": "Đã gửi", "failed": "Gửi lỗi", "unconfigured": "Chưa cấu hình SMTP"}
EMAIL_KINDS = {
    "reset_password": "Đặt lại mật khẩu", "register_admin": "Báo có đăng ký tài khoản", "account_approved": "Tài khoản được duyệt",
    "subscribe_confirm": "Xác nhận đăng ký nhận tin", "new_issue": "Thư báo số mới", "test": "Thư thử",
}


class EmailOutbox(Base):
    """Hộp thư đi: mọi email hệ thống tạo ra. Chưa cấu hình SMTP thì vẫn lưu ở đây (trạng thái unconfigured)."""

    __tablename__ = "email_outbox"
    __table_args__ = {"info": ALEMBIC_INFO}
    id: Mapped[int] = mapped_column(primary_key=True)
    to_email: Mapped[str] = mapped_column(String(255), index=True)
    subject: Mapped[str] = mapped_column(String(300))
    body_text: Mapped[str] = mapped_column(Text)
    body_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    kind: Mapped[str] = mapped_column(String(30), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # ví dụ {"unsubscribe": url}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Setting(Base):
    """Cấu hình site dạng key/value (footer, lãnh đạo, giấy phép...)."""

    __tablename__ = "settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True)
    value: Mapped[str] = mapped_column(Text, default="")
