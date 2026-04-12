import logging
import os
from sqlalchemy.orm import Session
from app.models.job import ProcessingJob, JobStage
from app.models.lecture import Lecture
from app.models.media_asset import MediaAsset
from app.models.transcript import Transcript
from app.models.note import Note
from app.models.log import SystemLog
from app.services.youtube_service import sanitize_terminal_text

logger = logging.getLogger("somali_notes.pipeline")

list_of_pipeline_stages = [
    JobStage.validating_input,
    JobStage.preparing_media,
    JobStage.extracting_audio,
    JobStage.preparing_audio,
    JobStage.transcribing,
    JobStage.cleaning_transcript,
    JobStage.generating_notes,
    JobStage.saving_results
]

def create_system_log(
    db: Session,
    level: str,
    message: str,
    lecture_id: int,
    metadata: dict | None = None,
):
    cleaned_message = sanitize_terminal_text(message)
    payload = {"lecture_id": lecture_id}
    if metadata:
        payload.update(metadata)

    log_level = level.upper()
    if log_level == "ERROR":
        logger.error("[lecture:%s] %s", lecture_id, cleaned_message)
    elif log_level == "WARNING":
        logger.warning("[lecture:%s] %s", lecture_id, cleaned_message)
    else:
        logger.info("[lecture:%s] %s", lecture_id, cleaned_message)

    db.add(
        SystemLog(
            level=level,
            message=cleaned_message,
            metadata_json=payload,
        )
    )
    db.commit()

def update_stage(db: Session, job: ProcessingJob, stage: JobStage):
    job.stage = stage
    index = list_of_pipeline_stages.index(stage)
    job.progress_percent = int((index / len(list_of_pipeline_stages)) * 100)
    db.commit()

def update_stage_progress(
    db: Session,
    job: ProcessingJob,
    stage: JobStage,
    fraction: float,
):
    stage_index = list_of_pipeline_stages.index(stage)
    stage_span = 100 / len(list_of_pipeline_stages)
    start = stage_index * stage_span
    next_progress = int(start + max(0.0, min(1.0, fraction)) * stage_span)

    if next_progress != job.progress_percent:
        job.progress_percent = next_progress
        db.commit()

def execute_pipeline(db: Session, job: ProcessingJob, lecture_id: int):
    from app.services.media_service import MediaService
    from app.services.youtube_service import YouTubeService
    from app.services.transcription_service import TranscriptionService
    from app.services.note_generation_service import NoteGenerationService

    media_svc = MediaService()
    youtube_svc = YouTubeService()
    transcript_svc = TranscriptionService()
    notes_svc = NoteGenerationService()

    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise ValueError("Lecture not found")

    # 1. validating_input
    update_stage(db, job, JobStage.validating_input)
    create_system_log(db, "INFO", "Validating lecture input.", lecture_id)
    if lecture.source_type == "youtube" and not youtube_svc.is_valid_url(lecture.source_url):
        raise ValueError("Invalid YouTube URL")
    
    # 2. preparing_media
    update_stage(db, job, JobStage.preparing_media)
    create_system_log(db, "INFO", "Preparing source media.", lecture_id)
    video_path = lecture.source_url
    if lecture.source_type == "youtube":
        last_logged_bucket = {"value": -5}

        def report_download_progress(status: dict):
            status_name = status.get("status")

            if status_name == "downloading":
                downloaded = status.get("downloaded_bytes") or 0
                total = status.get("total_bytes") or status.get("total_bytes_estimate") or 0
                if total:
                    percent = int((downloaded / total) * 100)
                    bucket = min(100, (percent // 5) * 5)
                    if bucket > last_logged_bucket["value"]:
                        last_logged_bucket["value"] = bucket
                        update_stage_progress(
                            db,
                            job,
                            JobStage.preparing_media,
                            percent / 100,
                        )
                        create_system_log(
                            db,
                            "INFO",
                            f"Download progress: {percent}% ({downloaded} / {total} bytes)",
                            lecture_id,
                            {"download_percent": percent},
                        )
            elif status_name == "finished":
                update_stage_progress(db, job, JobStage.preparing_media, 1.0)
                create_system_log(
                    db,
                    "INFO",
                    f"Download complete: {status.get('filename', 'media file')}",
                    lecture_id,
                )

        video_path = youtube_svc.download_audio(
            lecture.source_url,
            progress_callback=report_download_progress,
        )

    # Validate video path exists
    if not os.path.exists(video_path):
        raise ValueError("Media file not found")

    # 3. extracting_audio & 4. preparing_audio
    update_stage(db, job, JobStage.extracting_audio)
    create_system_log(db, "INFO", "Extracting audio from media.", lecture_id)
    update_stage(db, job, JobStage.preparing_audio)
    create_system_log(db, "INFO", "Preparing audio for transcription.", lecture_id)
    audio_temp_path = os.path.join(media_svc.temp_dir, f"{lecture_id}_audio.wav")
    extracted_audio_path = media_svc.extract_audio(video_path, audio_temp_path)

    # 5. transcribing
    update_stage(db, job, JobStage.transcribing)
    create_system_log(db, "INFO", "Transcribing audio.", lecture_id)
    raw_text = transcript_svc.transcribe_audio(extracted_audio_path)

    # 6. cleaning_transcript
    update_stage(db, job, JobStage.cleaning_transcript)
    create_system_log(db, "INFO", "Cleaning transcript.", lecture_id)
    cleaned_text = raw_text.strip()

    # 7. generating_notes
    update_stage(db, job, JobStage.generating_notes)
    create_system_log(db, "INFO", "Generating Somali notes.", lecture_id)
    somali_notes_data = notes_svc.generate_somali_notes(cleaned_text)

    # 8. saving_results
    update_stage(db, job, JobStage.saving_results)
    create_system_log(db, "INFO", "Saving lecture results.", lecture_id)
    
    # Save MediaAsset info
    duration = media_svc.get_media_duration(video_path)
    asset = MediaAsset(file_path=video_path, media_type="video", duration_seconds=int(duration), lecture_id=lecture.id)
    db.add(asset)

    # Save Transcript
    transcript = Transcript(raw_text=raw_text, cleaned_text=cleaned_text, lecture_id=lecture.id)
    db.add(transcript)

    # Save Notes
    note = Note(
        structured_content=somali_notes_data.get("structured_content", ""),
        summary=somali_notes_data.get("summary", ""),
        key_points=somali_notes_data.get("key_points", []),
        lecture_id=lecture.id
    )
    db.add(note)

    # Link everything cleanly and commit
    db.commit()
    create_system_log(db, "INFO", "Lecture processing completed successfully.", lecture_id)

    # Clean up temp audio if not needed
    media_svc.cleanup_file(extracted_audio_path)

    # We can also clean up youtube video if we dont want to keep it
    if lecture.source_type == "youtube":
        media_svc.cleanup_file(video_path)
