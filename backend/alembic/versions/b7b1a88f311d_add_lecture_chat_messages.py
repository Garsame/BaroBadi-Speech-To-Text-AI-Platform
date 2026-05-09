"""Add lecture chat messages table

Revision ID: b7b1a88f311d
Revises: a4d4c8d8e1b2
Create Date: 2026-04-18 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7b1a88f311d"
down_revision: Union[str, Sequence[str], None] = "a4d4c8d8e1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lecture_chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "role",
            sa.Enum("user", "assistant", name="chatmessagerole"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("lecture_id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["lecture_id"], ["lectures.id"]),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_lecture_chat_messages_id"),
        "lecture_chat_messages",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lecture_chat_messages_lecture_id"),
        "lecture_chat_messages",
        ["lecture_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lecture_chat_messages_owner_id"),
        "lecture_chat_messages",
        ["owner_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_lecture_chat_messages_owner_id"), table_name="lecture_chat_messages")
    op.drop_index(op.f("ix_lecture_chat_messages_lecture_id"), table_name="lecture_chat_messages")
    op.drop_index(op.f("ix_lecture_chat_messages_id"), table_name="lecture_chat_messages")
    op.drop_table("lecture_chat_messages")
