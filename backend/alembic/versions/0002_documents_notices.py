"""documents and notices

Revision ID: 0002_documents_notices
Revises: 0143e994c094
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0002_documents_notices'
down_revision: Union[str, Sequence[str], None] = '0143e994c094'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('documents',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('doc_type', sa.String(60), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('file_key', sa.String(500), nullable=True),
        sa.Column('file_name', sa.String(300), nullable=False),
        sa.Column('external_url', sa.String(1000), nullable=False),
        sa.Column('status', sa.String(30), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_documents_doc_type', 'documents', ['doc_type'])
    op.create_index('ix_documents_status', 'documents', ['status'])
    op.create_table('notices',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(600), nullable=False),
        sa.Column('slug', sa.String(700), nullable=False),
        sa.Column('tag', sa.String(60), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('body_html', sa.Text(), nullable=False),
        sa.Column('notice_date', sa.Date(), nullable=False),
        sa.Column('is_pinned', sa.Boolean(), nullable=False),
        sa.Column('status', sa.String(30), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_notices_slug', 'notices', ['slug'], unique=True)
    op.create_index('ix_notices_notice_date', 'notices', ['notice_date'])
    op.create_index('ix_notices_status', 'notices', ['status'])


def downgrade() -> None:
    op.drop_table('notices')
    op.drop_table('documents')
