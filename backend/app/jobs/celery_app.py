from celery import Celery
import os

# Instead of Redis, we use local SQLite files for local development on Windows
broker_url = os.getenv("CELERY_BROKER_URL", "sqla+sqlite:///celery_broker.sqlite")
backend_url = os.getenv("CELERY_RESULT_BACKEND", "db+sqlite:///celery_backend.sqlite")

celery_app = Celery(
    "somali_notes_worker",
    broker=broker_url,
    backend=backend_url,
    include=["app.jobs.worker"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)
