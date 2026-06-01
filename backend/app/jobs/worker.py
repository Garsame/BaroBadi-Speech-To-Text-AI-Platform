from datetime import datetime
import logging
import uuid

from app.core.database import SessionLocal
from app.jobs.celery_app import celery_app
from app.jobs.pipeline import LectureProcessingCanceled, create_system_log, raise_if_canceled
from app.models.job import JobStage, JobStatus, ProcessingJob
from app.models.lecture import Lecture, LectureStatus
from app.services.ai_error_utils import format_exception_for_user
from app.services.youtube_service import sanitize_terminal_text

logger = logging.getLogger("somali_notes.worker")


def _progress_for_stage(stage) -> int:
    from app.jobs.pipeline import list_of_pipeline_stages

    if stage in list_of_pipeline_stages:
        index = list_of_pipeline_stages.index(stage)
        return int((index / len(list_of_pipeline_stages)) * 100)
    return 0


@celery_app.task(bind=True)
def process_lecture_pipeline(self, lecture_id: int):
    """
    Main pipeline task that tracks its status and executes pipeline stages sequentially.
    """
    db = SessionLocal()
    job = db.query(ProcessingJob).filter(ProcessingJob.lecture_id == lecture_id).first()
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()

    if not job:
        db.close()
        return

    if str(job.status).endswith("canceled") or str(job.stage).endswith("canceled") or (
        lecture and str(lecture.status).endswith("canceled")
    ):
        db.close()
        return

    job.task_id = self.request.id
    job.status = JobStatus.running
    job.started_at = datetime.utcnow()
    job.completed_at = None
    job.error_message = None
    job.progress_percent = 0
    if lecture:
        lecture.status = LectureStatus.processing
    db.commit()
    create_system_log(db, "INFO", "Lecture job started.", lecture_id)

    try:
        from app.jobs.pipeline import execute_pipeline

        execute_pipeline(db, job, lecture_id)
        raise_if_canceled(db, job, lecture_id, lecture)

        job.status = JobStatus.success
        job.stage = JobStage.completed
        job.progress_percent = 100
        job.completed_at = datetime.utcnow()
        if lecture:
            lecture.status = LectureStatus.completed
            from app.models.log import ActivityLog
            db.add(
                ActivityLog(
                    action="LECTURE_COMPLETED",
                    user_id=lecture.owner_id,
                    details={
                        "lecture_id": lecture.id,
                        "title": lecture.title,
                    }
                )
            )
        db.commit()
        create_system_log(db, "INFO", "Lecture job finished.", lecture_id)
    except LectureProcessingCanceled:
        db.refresh(job)
        if lecture:
            db.refresh(lecture)
            lecture.status = LectureStatus.canceled

        job.status = JobStatus.canceled
        job.stage = JobStage.canceled
        job.error_message = None
        job.completed_at = job.completed_at or datetime.utcnow()
        db.commit()
    except Exception as e:
        db.refresh(job)
        if lecture:
            db.refresh(lecture)

        if str(job.status).endswith("canceled") or str(job.stage).endswith("canceled") or (
            lecture and str(lecture.status).endswith("canceled")
        ):
            job.status = JobStatus.canceled
            job.stage = JobStage.canceled
            job.error_message = None
            job.completed_at = job.completed_at or datetime.utcnow()
            db.commit()
            db.close()
            return

        failed_stage = job.stage
        failed_progress = max(job.progress_percent, _progress_for_stage(failed_stage))
        logger.exception(
            "Lecture job failed for lecture_id=%s at stage=%s",
            lecture_id,
            failed_stage,
        )
        job.status = JobStatus.error
        job.stage = JobStage.failed
        job.progress_percent = failed_progress
        job.completed_at = datetime.utcnow()
        job.error_message = sanitize_terminal_text(format_exception_for_user(e, failed_stage))
        if lecture:
            lecture.status = LectureStatus.failed
            from app.models.log import ActivityLog
            db.add(
                ActivityLog(
                    action="LECTURE_FAILED",
                    user_id=lecture.owner_id,
                    details={
                        "lecture_id": lecture.id,
                        "title": lecture.title,
                        "error_stage": str(failed_stage),
                    }
                )
            )
        db.commit()
        create_system_log(
            db,
            "ERROR",
            job.error_message,
            lecture_id,
            {"failed_stage": str(failed_stage)},
        )
    finally:
        db.close()


def process_lecture_pipeline_sync(lecture_id: int):
    """
    Synchronous fallback for FastAPI Background Tasks (No Redis Required).
    """
    db = SessionLocal()
    job = db.query(ProcessingJob).filter(ProcessingJob.lecture_id == lecture_id).first()
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()

    if not job:
        db.close()
        return

    if str(job.status).endswith("canceled") or str(job.stage).endswith("canceled") or (
        lecture and str(lecture.status).endswith("canceled")
    ):
        db.close()
        return

    job.task_id = str(uuid.uuid4())
    job.status = JobStatus.running
    job.started_at = datetime.utcnow()
    job.completed_at = None
    job.error_message = None
    job.progress_percent = 0
    if lecture:
        lecture.status = LectureStatus.processing
    db.commit()
    create_system_log(db, "INFO", "Lecture job started.", lecture_id)

    try:
        from app.jobs.pipeline import execute_pipeline

        execute_pipeline(db, job, lecture_id)
        raise_if_canceled(db, job, lecture_id, lecture)

        job.status = JobStatus.success
        job.stage = JobStage.completed
        job.progress_percent = 100
        job.completed_at = datetime.utcnow()
        if lecture:
            lecture.status = LectureStatus.completed
            from app.models.log import ActivityLog
            db.add(
                ActivityLog(
                    action="LECTURE_COMPLETED",
                    user_id=lecture.owner_id,
                    details={
                        "lecture_id": lecture.id,
                        "title": lecture.title,
                    }
                )
            )
        db.commit()
        create_system_log(db, "INFO", "Lecture job finished.", lecture_id)
    except LectureProcessingCanceled:
        db.refresh(job)
        if lecture:
            db.refresh(lecture)
            lecture.status = LectureStatus.canceled

        job.status = JobStatus.canceled
        job.stage = JobStage.canceled
        job.error_message = None
        job.completed_at = job.completed_at or datetime.utcnow()
        db.commit()
    except Exception as e:
        db.refresh(job)
        if lecture:
            db.refresh(lecture)

        if str(job.status).endswith("canceled") or str(job.stage).endswith("canceled") or (
            lecture and str(lecture.status).endswith("canceled")
        ):
            job.status = JobStatus.canceled
            job.stage = JobStage.canceled
            job.error_message = None
            job.completed_at = job.completed_at or datetime.utcnow()
            db.commit()
            db.close()
            return

        failed_stage = job.stage
        failed_progress = max(job.progress_percent, _progress_for_stage(failed_stage))
        logger.exception(
            "Lecture job failed for lecture_id=%s at stage=%s",
            lecture_id,
            failed_stage,
        )
        job.status = JobStatus.error
        job.stage = JobStage.failed
        job.progress_percent = failed_progress
        job.completed_at = datetime.utcnow()
        job.error_message = sanitize_terminal_text(format_exception_for_user(e, failed_stage))
        if lecture:
            lecture.status = LectureStatus.failed
            from app.models.log import ActivityLog
            db.add(
                ActivityLog(
                    action="LECTURE_FAILED",
                    user_id=lecture.owner_id,
                    details={
                        "lecture_id": lecture.id,
                        "title": lecture.title,
                        "error_stage": str(failed_stage),
                    }
                )
            )
        db.commit()
        create_system_log(
            db,
            "ERROR",
            job.error_message,
            lecture_id,
            {"failed_stage": str(failed_stage)},
        )
    finally:
        db.close()
