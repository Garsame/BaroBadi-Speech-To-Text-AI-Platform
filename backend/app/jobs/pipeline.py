import concurrent.futures
import logging
import os
from math import ceil
from threading import Lock
from sqlalchemy.orm import Session
from app.models.job import ProcessingJob, JobStage
from app.models.lecture import Lecture
from app.models.media_asset import MediaAsset
from app.models.transcript import Transcript
from app.models.note import Note
from app.models.log import SystemLog
from app.core.config import load_settings
from app.services.ai_error_utils import format_exception_for_user
from app.services.youtube_service import sanitize_terminal_text

logger = logging.getLogger("somali_notes.pipeline")

CANCEL_MESSAGE = "Lecture processing was canceled by the user."

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


class LectureProcessingCanceled(Exception):
    pass

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

def raise_if_canceled(
    db: Session,
    job: ProcessingJob,
    lecture_id: int,
    lecture: Lecture | None = None,
):
    db.refresh(job)
    if lecture is None:
        lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    elif lecture is not None:
        db.refresh(lecture)

    if (
        str(job.status).endswith("canceled")
        or str(job.stage).endswith("canceled")
        or (lecture is not None and str(lecture.status).endswith("canceled"))
    ):
        raise LectureProcessingCanceled(CANCEL_MESSAGE)


def update_stage(
    db: Session,
    job: ProcessingJob,
    stage: JobStage,
    lecture: Lecture | None = None,
):
    raise_if_canceled(db, job, job.lecture_id, lecture)
    job.stage = stage
    index = list_of_pipeline_stages.index(stage)
    job.progress_percent = int((index / len(list_of_pipeline_stages)) * 100)
    db.commit()

def update_stage_progress(
    db: Session,
    job: ProcessingJob,
    stage: JobStage,
    fraction: float,
    lecture: Lecture | None = None,
):
    raise_if_canceled(db, job, job.lecture_id, lecture)
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
    from app.services.lecture_analysis_service import LectureAnalysisService

    media_svc = MediaService()
    youtube_svc = YouTubeService()
    transcript_svc = TranscriptionService()
    notes_svc = NoteGenerationService()
    analysis_svc = LectureAnalysisService()
    settings = load_settings()

    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise ValueError("Lecture not found")

    raise_if_canceled(db, job, lecture_id, lecture)

    # 1. validating_input
    update_stage(db, job, JobStage.validating_input, lecture)
    create_system_log(db, "INFO", "Validating lecture input.", lecture_id)
    if lecture.source_type == "youtube" and not youtube_svc.is_valid_url(lecture.source_url):
        raise ValueError("Invalid YouTube URL")

    transcript_source = "audio_transcription"
    raw_text = ""
    extracted_audio_path: str | None = None
    downloaded_video_path: str | None = None
    media_duration = 0.0
    media_file_size: int | None = None

    # 2. preparing_media
    update_stage(db, job, JobStage.preparing_media, lecture)
    create_system_log(db, "INFO", "Preparing source media.", lecture_id)
    video_path = lecture.source_url
    if lecture.source_type == "youtube":
        create_system_log(
            db,
            "INFO",
            "Checking whether YouTube captions are available before downloading the full media.",
            lecture_id,
        )
        try:
            transcript_bundle = youtube_svc.download_transcript_bundle(lecture.source_url)
        except Exception as exc:
            create_system_log(
                db,
                "WARNING",
                f"Could not use YouTube captions before download: {exc}",
                lecture_id,
            )
            transcript_bundle = None

        last_logged_bucket = {"value": -5}

        def report_download_progress(status: dict):
            raise_if_canceled(db, job, lecture_id, lecture)
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
                            lecture,
                        )
                        create_system_log(
                            db,
                            "INFO",
                            f"Download progress: {percent}% ({downloaded} / {total} bytes)",
                            lecture_id,
                            {"download_percent": percent},
                        )
            elif status_name == "finished":
                update_stage_progress(
                    db,
                    job,
                    JobStage.preparing_media,
                    1.0,
                    lecture,
                )
                create_system_log(
                    db,
                    "INFO",
                    f"Download complete: {status.get('filename', 'media file')}",
                    lecture_id,
                )

        downloaded_video_path = youtube_svc.download_audio(
            lecture.source_url,
            progress_callback=report_download_progress,
        )
        video_path = downloaded_video_path
        raise_if_canceled(db, job, lecture_id, lecture)

        if not os.path.exists(video_path):
            raise ValueError("Media file not found")

        media_duration = media_svc.get_media_duration(video_path)
        media_file_size = media_svc.get_file_size_bytes(video_path)

        if transcript_bundle:
            transcript_source = "youtube_captions"
            raw_text = str(transcript_bundle.get("text") or "").strip()
            # media_duration was already detected more accurately by getting the real media duration
            create_system_log(
                db,
                "INFO",
                "YouTube captions were found. Downloaded audio for playback, but skipping AI transcription.",
                lecture_id,
                {
                    "transcript_source": transcript_source,
                },
            )
    else:
        if not os.path.exists(video_path):
            raise ValueError("Media file not found")

        media_duration = media_svc.get_media_duration(video_path)
        media_file_size = media_svc.get_file_size_bytes(video_path)

    media_asset = db.query(MediaAsset).filter(MediaAsset.lecture_id == lecture.id).first()
    if not media_asset:
        media_asset = MediaAsset(lecture_id=lecture.id)
        db.add(media_asset)

    media_asset.file_path = (
        (downloaded_video_path or lecture.source_url)
        if lecture.source_type == "youtube"
        else video_path
    )
    media_asset.media_type = (
        "youtube"
        if lecture.source_type == "youtube" and not downloaded_video_path
        else "video"
    )
    media_asset.file_size_bytes = media_file_size
    media_asset.duration_seconds = int(media_duration) if media_duration > 0 else None
    db.commit()

    if media_duration > 0:
        create_system_log(
            db,
            "INFO",
            f"Detected media duration: {int(media_duration // 60)}m {int(media_duration % 60)}s.",
            lecture_id,
            {"duration_seconds": int(media_duration)},
        )

    max_duration_minutes = max(0, settings.YOUTUBE_MAX_DURATION_MINUTES)
    if max_duration_minutes > 0 and media_duration > max_duration_minutes * 60:
        raise ValueError(
            f"This lecture is {ceil(media_duration / 60)} minutes long, which exceeds the configured limit of {max_duration_minutes} minutes."
        )

    if raw_text:
        update_stage(db, job, JobStage.extracting_audio, lecture)
        create_system_log(
            db,
            "INFO",
            "Skipping audio extraction because YouTube captions were found.",
            lecture_id,
        )
        update_stage(db, job, JobStage.preparing_audio, lecture)
        create_system_log(
            db,
            "INFO",
            "Skipping audio preparation because YouTube captions were found.",
            lecture_id,
        )
        update_stage(db, job, JobStage.transcribing, lecture)
        create_system_log(
            db,
            "INFO",
            "Using YouTube captions as the transcript source for this lecture.",
            lecture_id,
            {"transcript_source": transcript_source},
        )
        update_stage_progress(db, job, JobStage.transcribing, 1.0, lecture)
    else:
        # 3. extracting_audio & 4. preparing_audio
        update_stage(db, job, JobStage.extracting_audio, lecture)
        create_system_log(db, "INFO", "Extracting audio from media.", lecture_id)
        update_stage(db, job, JobStage.preparing_audio, lecture)
        create_system_log(db, "INFO", "Preparing audio for transcription.", lecture_id)
        audio_temp_path = os.path.join(media_svc.temp_dir, f"{lecture_id}_audio.wav")
        extracted_audio_path = media_svc.extract_audio(video_path, audio_temp_path)
        raise_if_canceled(db, job, lecture_id, lecture)

        # 5. transcribing
        update_stage(db, job, JobStage.transcribing, lecture)
        create_system_log(db, "INFO", "Transcribing audio.", lecture_id)
        transcription_chunk_paths = [extracted_audio_path]

        min_chunk_seconds = max(60, settings.TRANSCRIPTION_MIN_CHUNK_SECONDS)

        def transcribe_with_fallback(
            chunk_path: str,
            chunk_label: str,
            target_chunk_seconds: int,
        ) -> str:
            raise_if_canceled(db, job, lecture_id, lecture)
            try:
                return transcript_svc.transcribe_audio(chunk_path).strip()
            except Exception as exc:
                if not transcript_svc.is_recitation_error(exc):
                    raise

                chunk_duration = media_svc.get_media_duration(chunk_path)
                if chunk_duration <= min_chunk_seconds:
                    raise

                fallback_chunk_seconds = max(
                    min_chunk_seconds,
                    min(
                        int(chunk_duration // 2),
                        max(min_chunk_seconds, target_chunk_seconds // 2),
                    ),
                )
                smaller_chunk_paths = media_svc.split_audio(chunk_path, fallback_chunk_seconds)
                if len(smaller_chunk_paths) <= 1:
                    raise

                create_system_log(
                    db,
                    "WARNING",
                    f"Gemini rejected audio chunk {chunk_label} with a recitation response. Retrying with {len(smaller_chunk_paths)} smaller chunks of about {fallback_chunk_seconds // 60} minutes each.",
                    lecture_id,
                    {
                        "chunk_label": chunk_label,
                        "fallback_chunk_count": len(smaller_chunk_paths),
                        "fallback_chunk_seconds": fallback_chunk_seconds,
                    },
                )

                nested_parts: list[str] = []
                try:
                    for nested_index, nested_path in enumerate(smaller_chunk_paths, start=1):
                        nested_label = f"{chunk_label}.{nested_index}"
                        create_system_log(
                            db,
                            "INFO",
                            f"Transcribing fallback chunk {nested_label}.",
                            lecture_id,
                            {"chunk_label": nested_label},
                        )
                        nested_text = transcribe_with_fallback(
                            nested_path,
                            nested_label,
                            fallback_chunk_seconds,
                        )
                        if nested_text:
                            nested_parts.append(nested_text)
                finally:
                    for nested_path in smaller_chunk_paths:
                        if nested_path != chunk_path:
                            media_svc.cleanup_file(nested_path)

                return "\n\n".join(nested_parts).strip()

        try:
            chunk_seconds = max(min_chunk_seconds, settings.TRANSCRIPTION_CHUNK_SECONDS)
            transcription_chunk_paths = media_svc.split_audio(
                extracted_audio_path,
                chunk_seconds,
            )
            total_chunks = len(transcription_chunk_paths)

            if total_chunks > 1:
                create_system_log(
                    db,
                    "INFO",
                    f"Long audio detected. Splitting transcription into {total_chunks} chunks of about {chunk_seconds // 60} minutes each.",
                    lecture_id,
                    {
                        "chunk_count": total_chunks,
                        "chunk_seconds": chunk_seconds,
                    },
                )

            raw_transcript_parts: list[str | None] = [None] * total_chunks
            completed_chunks = 0
            progress_lock = Lock()

            def process_chunk(index: int, chunk_path: str):
                nonlocal completed_chunks
                try:
                    text = transcribe_with_fallback(
                        chunk_path,
                        f"{index}/{total_chunks}",
                        chunk_seconds,
                    )

                    with progress_lock:
                        raw_transcript_parts[index - 1] = text
                        completed_chunks += 1
                    return text
                except Exception as exc:
                    logger.error(f"Error transcribing chunk {index}: {exc}")
                    raise

            create_system_log(
                db,
                "INFO",
                f"Starting parallel transcription of {total_chunks} chunks.",
                lecture_id,
            )

            with concurrent.futures.ThreadPoolExecutor(max_workers=min(total_chunks, 10)) as executor:
                future_to_index = {
                    executor.submit(process_chunk, i, path): i
                    for i, path in enumerate(transcription_chunk_paths, start=1)
                }

                for future in concurrent.futures.as_completed(future_to_index):
                    idx = future_to_index[future]
                    try:
                        future.result()
                        update_stage_progress(
                            db,
                            job,
                            JobStage.transcribing,
                            completed_chunks / total_chunks,
                            lecture,
                        )
                    except Exception as exc:
                        raise RuntimeError(
                            f"Transcription failed on audio chunk {idx} of {total_chunks}: {exc}"
                        ) from exc

            raw_text = "\n\n".join(filter(None, raw_transcript_parts)).strip()
            if not raw_text:
                raise RuntimeError("Transcription completed but returned no usable text.")
        finally:
            for chunk_path in transcription_chunk_paths:
                if chunk_path != extracted_audio_path:
                    media_svc.cleanup_file(chunk_path)

        raise_if_canceled(db, job, lecture_id, lecture)

    # 6. cleaning_transcript
    update_stage(db, job, JobStage.cleaning_transcript, lecture)
    create_system_log(db, "INFO", "Cleaning transcript.", lecture_id)
    cleaned_text = raw_text.strip()

    # 7. generating_notes
    update_stage(db, job, JobStage.generating_notes, lecture)
    create_system_log(db, "INFO", "Generating Somali notes.", lecture_id)
    somali_notes_data = notes_svc.generate_somali_notes(cleaned_text)
    raise_if_canceled(db, job, lecture_id, lecture)
    note_generation_metadata = somali_notes_data.get("metadata")
    if isinstance(note_generation_metadata, dict) and note_generation_metadata.get("repair_applied"):
        create_system_log(
            db,
            "INFO",
            "Somali notes required AI repair and passed the QA checks before saving.",
            lecture_id,
            {
                "repair_attempts": note_generation_metadata.get("repair_attempts", 0),
                "guardrail_version": note_generation_metadata.get("guardrail_version"),
            },
        )
    create_system_log(
        db,
        "INFO",
        "Running AI valuation and genre classification.",
        lecture_id,
    )
    try:
        analysis_data = analysis_svc.analyze_lecture(
            lecture.title,
            cleaned_text,
            somali_notes_data,
        )
    except Exception as exc:
        analysis_data = {
            "confidence_score": None,
            "confidence_label": "Analysis unavailable",
            "valuation_summary": (
                "The Somali notes were generated, but the optional AI valuation step was unavailable."
            ),
            "genre_label": "Analysis unavailable",
            "subject_category": "Other Subjects",
            "genre_explanation": (
                "The provider could not complete the optional genre classification step."
            ),
        }
        create_system_log(
            db,
            "WARNING",
            f"AI valuation and genre classification were skipped: {format_exception_for_user(exc, 'lecture_analysis')}",
            lecture_id,
        )
    raise_if_canceled(db, job, lecture_id, lecture)

    # 8. saving_results
    update_stage(db, job, JobStage.saving_results, lecture)
    create_system_log(db, "INFO", "Saving lecture results.", lecture_id)

    # Save Transcript
    transcript_metadata = {
        "analysis": analysis_data,
        "transcript_source": transcript_source,
    }
    if isinstance(note_generation_metadata, dict):
        transcript_metadata["note_generation"] = note_generation_metadata

    transcript = Transcript(
        raw_text=raw_text,
        cleaned_text=cleaned_text,
        metadata_json=transcript_metadata,
        lecture_id=lecture.id,
    )
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
    raise_if_canceled(db, job, lecture_id, lecture)
    db.commit()
    create_system_log(db, "INFO", "Lecture processing completed successfully.", lecture_id)

    # Clean up temp audio if not needed
    if extracted_audio_path:
        media_svc.cleanup_file(extracted_audio_path)

    # We intentionally do NOT cleanup downloaded_video_path here so it can be streamed on the dashboard.
