from __future__ import annotations
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, Boolean, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core import Base


def uuid_str():
    return str(uuid4())


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = 'users'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    role: Mapped[str] = mapped_column(String(30), default='editor')
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Issue(Base):
    __tablename__ = 'issues'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    number: Mapped[int] = mapped_column(Integer, index=True)
    month: Mapped[int] = mapped_column(Integer)
    year: Mapped[int] = mapped_column(Integer, index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(500))
    theme: Mapped[str] = mapped_column(String(600), default='')
    description: Mapped[str] = mapped_column(Text, default='')
    editorial: Mapped[str] = mapped_column(Text, default='')
    cover_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pdf_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pdf_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default='draft')
    imprint: Mapped[str] = mapped_column(Text, default='')
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    sections: Mapped[list[Section]] = relationship(back_populates='issue', cascade='all,delete-orphan', order_by='Section.sort_order')
    articles: Mapped[list[Article]] = relationship(back_populates='issue', cascade='all,delete-orphan', order_by='Article.sort_order')
    __table_args__ = (UniqueConstraint('number', 'year', name='uq_issue_number_year'),)


class Section(Base):
    __tablename__ = 'sections'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    issue_id: Mapped[str] = mapped_column(ForeignKey('issues.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(300))
    slug: Mapped[str] = mapped_column(String(350))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    issue: Mapped[Issue] = relationship(back_populates='sections')
    articles: Mapped[list[Article]] = relationship(back_populates='section')
    __table_args__ = (UniqueConstraint('issue_id', 'slug', name='uq_issue_section_slug'),)


class Article(Base):
    __tablename__ = 'articles'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    issue_id: Mapped[str] = mapped_column(ForeignKey('issues.id', ondelete='CASCADE'), index=True)
    section_id: Mapped[str | None] = mapped_column(ForeignKey('sections.id', ondelete='SET NULL'), nullable=True)
    title: Mapped[str] = mapped_column(String(1000))
    slug: Mapped[str] = mapped_column(String(1200), unique=True, index=True)
    author_display: Mapped[str] = mapped_column(String(400), default='')
    content_type: Mapped[str] = mapped_column(String(35), default='article')
    summary: Mapped[str] = mapped_column(Text, default='')
    body_html: Mapped[str] = mapped_column(Text, default='')
    raw_extracted_text: Mapped[str] = mapped_column(Text, default='')
    full_text_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    print_page_start: Mapped[int] = mapped_column(Integer, default=1)
    print_page_end: Mapped[int] = mapped_column(Integer, default=1)
    pdf_page_start: Mapped[int] = mapped_column(Integer, default=1)
    pdf_page_end: Mapped[int] = mapped_column(Integer, default=1)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default='draft')
    issue: Mapped[Issue] = relationship(back_populates='articles')
    section: Mapped[Section | None] = relationship(back_populates='articles')
    __table_args__ = (Index('ix_articles_issue_sort', 'issue_id', 'sort_order'),)


class ImportJob(Base):
    __tablename__ = 'import_jobs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    issue_id: Mapped[str | None] = mapped_column(ForeignKey('issues.id', ondelete='SET NULL'), nullable=True)
    filename: Mapped[str] = mapped_column(String(400))
    storage_key: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(40), default='uploaded')
    progress: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    action: Mapped[str] = mapped_column(String(100))
    target_id: Mapped[str] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
