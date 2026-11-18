"""activities

Revision ID: 0003_activities
Revises: 0002_documents_notices
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0003_activities'
down_revision: Union[str, Sequence[str], None] = '0002_documents_notices'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('activities',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(600), nullable=False),
        sa.Column('slug', sa.String(700), nullable=False),
        sa.Column('kind', sa.String(100), nullable=False),
        sa.Column('activity_date', sa.Date(), nullable=False),
        sa.Column('location', sa.String(300), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('body_html', sa.Text(), nullable=False),
        sa.Column('external_url', sa.String(1000), nullable=False),
        sa.Column('status', sa.String(30), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_activities_slug', 'activities', ['slug'], unique=True)
    op.create_index('ix_activities_activity_date', 'activities', ['activity_date'])
    op.create_index('ix_activities_status', 'activities', ['status'])


def downgrade() -> None:
    op.drop_table('activities')
