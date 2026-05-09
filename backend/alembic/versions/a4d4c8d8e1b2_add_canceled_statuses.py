"""Add canceled lecture and job statuses

Revision ID: a4d4c8d8e1b2
Revises: 25d938f633e7
Create Date: 2026-04-18 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a4d4c8d8e1b2"
down_revision: Union[str, Sequence[str], None] = "25d938f633e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute("ALTER TYPE lecturestatus ADD VALUE IF NOT EXISTS 'canceled'")
    op.execute("ALTER TYPE jobstatus ADD VALUE IF NOT EXISTS 'canceled'")
    op.execute("ALTER TYPE jobstage ADD VALUE IF NOT EXISTS 'canceled'")


def downgrade() -> None:
    """PostgreSQL enum value removal is intentionally left manual."""
    return
