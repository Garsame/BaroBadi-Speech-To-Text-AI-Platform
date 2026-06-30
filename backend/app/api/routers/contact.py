from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.models.contact_message import ContactMessage
from app.schemas.contact_message import ContactMessageCreate, ContactMessageInDB
from app.services.email import send_contact_message_email

router = APIRouter()

@router.post("/", response_model=ContactMessageInDB, status_code=status.HTTP_201_CREATED)
def create_contact_message(
    *,
    db: Session = Depends(get_db),
    message_in: ContactMessageCreate,
) -> Any:
    """
    Submit a new contact message.
    Saves it to the database and sends an email notification to the Baro Platform team.
    """
    try:
        # Save to database
        db_message = ContactMessage(
            name=message_in.name,
            email=message_in.email,
            topic=message_in.topic,
            message=message_in.message,
        )
        db.add(db_message)
        db.commit()
        db.refresh(db_message)

        # Dispatch email
        send_contact_message_email(
            name=db_message.name,
            email=db_message.email,
            topic=db_message.topic,
            message=db_message.message,
        )

        return db_message
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while saving the message: {str(e)}"
        )
