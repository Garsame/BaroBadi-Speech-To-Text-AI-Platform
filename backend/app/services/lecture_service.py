import logging
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from app.models.lecture import Lecture, LectureStatus
from app.models.job import JobStage, JobStatus
from app.models.log import SystemLog
from app.models.media_asset import MediaAsset
from app.models.note import Note
from app.models.transcript import Transcript
from app.schemas.lecture import LectureCreate
from typing import List, Optional

from fastapi import BackgroundTasks

logger = logging.getLogger("somali_notes.lecture_service")


class LectureService:
    def __init__(self, db: Session, background_tasks: BackgroundTasks = None):
        self.db = db
        self.background_tasks = background_tasks

    def get_lectures_by_user(self, owner_id: int) -> List[Lecture]:
        lectures = self.db.query(Lecture).options(joinedload(Lecture.job)).filter(
            Lecture.owner_id == owner_id
        ).all()
        self._sync_lecture_statuses(lectures)
        return lectures

    def get_lecture(self, lecture_id: int, owner_id: int) -> Optional[Lecture]:
        lecture = self.db.query(Lecture).options(joinedload(Lecture.job)).filter(
            Lecture.id == lecture_id, Lecture.owner_id == owner_id
        ).first()
        if lecture:
            self._sync_lecture_statuses([lecture])
        return lecture

    def get_lecture_with_details(self, lecture_id: int, owner_id: int) -> Optional[Lecture]:
        lecture = (
            self.db.query(Lecture)
            .options(
                joinedload(Lecture.transcript),
                joinedload(Lecture.notes),
                joinedload(Lecture.job),
                joinedload(Lecture.media_asset),
            )
            .filter(Lecture.id == lecture_id, Lecture.owner_id == owner_id)
            .first()
        )
        if lecture:
            self._sync_lecture_statuses([lecture])
            self._ensure_ai_analysis(lecture)
        return lecture

    def _ensure_ai_analysis(self, lecture: Lecture) -> None:
        transcript = lecture.transcript
        notes = lecture.notes

        if not transcript or not notes:
            return

        metadata = dict(transcript.metadata_json or {})
        if metadata.get("analysis"):
            return

        transcript_text = (transcript.cleaned_text or transcript.raw_text or "").strip()
        if not transcript_text:
            return

        try:
            from app.services.lecture_analysis_service import LectureAnalysisService

            analysis_service = LectureAnalysisService()
            metadata["analysis"] = analysis_service.analyze_lecture(
                lecture.title,
                transcript_text,
                {
                    "structured_content": notes.structured_content,
                    "summary": notes.summary or "",
                    "key_points": notes.key_points or [],
                },
            )
            transcript.metadata_json = metadata
            self.db.commit()
            self.db.refresh(transcript)
        except Exception:
            logger.exception(
                "Failed to generate cached AI analysis for lecture_id=%s.",
                lecture.id,
            )

    def _sync_lecture_statuses(self, lectures: List[Lecture]) -> None:
        updated = False

        for lecture in lectures:
            if not lecture.job:
                continue

            next_status = lecture.status
            job_status = str(lecture.job.status)
            job_stage = str(lecture.job.stage)

            if job_status.endswith("canceled") or job_stage.endswith("canceled"):
                next_status = LectureStatus.canceled
            elif job_status.endswith("running"):
                next_status = LectureStatus.processing
            elif job_status.endswith("success") or job_stage.endswith("completed"):
                next_status = LectureStatus.completed
            elif job_status.endswith("error") or job_stage.endswith("failed"):
                next_status = LectureStatus.failed

            if lecture.status != next_status:
                lecture.status = next_status
                updated = True

        if updated:
            self.db.commit()

    def _delete_lecture_processing_logs(self, lecture_id: int) -> None:
        logs = self.db.query(SystemLog).all()
        for log in logs:
            metadata = log.metadata_json
            if (
                isinstance(metadata, dict)
                and str(metadata.get("lecture_id")) == str(lecture_id)
            ):
                self.db.delete(log)

    def create_lecture(self, lecture_in: LectureCreate, owner_id: int) -> Lecture:
        db_obj = Lecture(
            title=lecture_in.title,
            source_type=lecture_in.source_type,
            source_url=lecture_in.source_url,
            owner_id=owner_id,
            status=LectureStatus.submitted
        )
        from app.models.job import ProcessingJob, JobStatus, JobStage
        job = ProcessingJob(
            status=JobStatus.pending,
            stage=JobStage.validating_input
        )
        self.db.add(db_obj)
        self.db.commit()
        
        job.lecture_id = db_obj.id
        self.db.add(job)
        self.db.commit()
        
        # Trigger background job gracefully using native FastAPI background tasks
        if self.background_tasks:
            from app.jobs.worker import process_lecture_pipeline_sync
            self.background_tasks.add_task(process_lecture_pipeline_sync, db_obj.id)
        
        return db_obj

    def retry_lecture(self, lecture_id: int, owner_id: int) -> Optional[Lecture]:
        lecture = self.db.query(Lecture).options(joinedload(Lecture.job)).filter(
            Lecture.id == lecture_id, Lecture.owner_id == owner_id
        ).first()
        if not lecture or not lecture.job:
            return None

        if lecture.job.status in {JobStatus.pending, JobStatus.running}:
            logger.warning(
                "Ignoring retry for lecture_id=%s because its job is already %s.",
                lecture_id,
                lecture.job.status,
            )
            return lecture

        transcript = self.db.query(Transcript).filter(Transcript.lecture_id == lecture_id).first()
        note = self.db.query(Note).filter(Note.lecture_id == lecture_id).first()
        media_asset = self.db.query(MediaAsset).filter(MediaAsset.lecture_id == lecture_id).first()

        if transcript:
            self.db.delete(transcript)
        if note:
            self.db.delete(note)
        if media_asset:
            self.db.delete(media_asset)

        self._delete_lecture_processing_logs(lecture_id)

        lecture.status = LectureStatus.submitted
        lecture.job.status = JobStatus.pending
        lecture.job.stage = JobStage.validating_input
        lecture.job.progress_percent = 0
        lecture.job.error_message = None
        lecture.job.started_at = None
        lecture.job.completed_at = None
        lecture.job.task_id = None
        self.db.commit()
        self.db.refresh(lecture)

        if self.background_tasks:
            from app.jobs.worker import process_lecture_pipeline_sync
            self.background_tasks.add_task(process_lecture_pipeline_sync, lecture.id)

        return lecture

    def cancel_lecture(self, lecture_id: int, owner_id: int) -> Optional[Lecture]:
        lecture = self.db.query(Lecture).options(joinedload(Lecture.job)).filter(
            Lecture.id == lecture_id, Lecture.owner_id == owner_id
        ).first()
        if not lecture or not lecture.job:
            return None

        job_status = str(lecture.job.status)
        job_stage = str(lecture.job.stage)

        if job_status.endswith("canceled") or job_stage.endswith("canceled"):
            lecture.status = LectureStatus.canceled
            lecture.job.status = JobStatus.canceled
            lecture.job.stage = JobStage.canceled
            lecture.job.progress_percent = 0
            lecture.job.completed_at = lecture.job.completed_at or datetime.utcnow()
            self._delete_lecture_processing_logs(lecture_id)
            self.db.commit()
            self.db.refresh(lecture)
            return lecture

        if lecture.job.status not in {JobStatus.pending, JobStatus.running}:
            raise ValueError("Only lectures that are still processing can be canceled.")

        lecture.status = LectureStatus.canceled
        lecture.job.status = JobStatus.canceled
        lecture.job.stage = JobStage.canceled
        lecture.job.progress_percent = 0
        lecture.job.error_message = None
        lecture.job.completed_at = datetime.utcnow()
        self.db.commit()
        self._delete_lecture_processing_logs(lecture_id)
        self.db.commit()
        self.db.refresh(lecture)
        return lecture
