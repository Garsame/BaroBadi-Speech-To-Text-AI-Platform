import os
import shutil
import math

import ffmpeg

from app.core.config import settings

class MediaService:
    def __init__(self):
        self.temp_dir = "temp_media"
        os.makedirs(self.temp_dir, exist_ok=True)
        self.ffmpeg_binary = self._resolve_binary(settings.FFMPEG_BINARY, "ffmpeg")
        self.ffprobe_binary = self._resolve_binary(
            settings.FFPROBE_BINARY,
            "ffprobe",
            sibling_source=self.ffmpeg_binary,
        )

    def _resolve_binary(
        self,
        configured_path: str | None,
        fallback_name: str,
        sibling_source: str | None = None,
    ) -> str | None:
        for candidate in (configured_path, fallback_name):
            if not candidate:
                continue

            resolved = shutil.which(candidate)
            if resolved:
                return resolved

            expanded = os.path.expandvars(os.path.expanduser(candidate))
            if os.path.isfile(expanded):
                return expanded

        if sibling_source:
            extension = ".exe" if os.name == "nt" else ""
            sibling = os.path.join(os.path.dirname(sibling_source), f"{fallback_name}{extension}")
            if os.path.isfile(sibling):
                return sibling

        return None

    def _missing_binary_message(self, binary_name: str, setting_name: str) -> str:
        configured_path = getattr(settings, setting_name) or "<not set>"
        return (
            f"{binary_name} executable was not found by the backend process. "
            f"{setting_name}={configured_path}. "
            "If you installed FFmpeg after starting the backend server, restart the backend so it reloads PATH. "
            "If that still fails, set the full executable path in backend/.env."
        )

    def extract_audio(self, video_path: str, output_path: str) -> str:
        """
        Extracts audio from a video file using FFmpeg.
        Returns the path to the extracted audio file.
        """
        try:
            # We enforce 16kHz, mono-channel for standard speech-to-text APIs.
            stream = ffmpeg.input(video_path)
            stream = ffmpeg.output(stream, output_path, ac=1, ar='16k', format='wav')
            ffmpeg.run(
                stream,
                overwrite_output=True,
                quiet=True,
                cmd=self.ffmpeg_binary or "ffmpeg",
            )
            return output_path
        except FileNotFoundError:
            raise RuntimeError(self._missing_binary_message("FFmpeg", "FFMPEG_BINARY"))
        except ffmpeg.Error as e:
            raise RuntimeError(f"FFmpeg failed to extract audio: {e.stderr.decode() if e.stderr else str(e)}")

    def split_audio(self, audio_path: str, chunk_duration_seconds: int) -> list[str]:
        if chunk_duration_seconds <= 0:
            return [audio_path]

        duration = self.get_media_duration(audio_path)
        if duration <= 0 or duration <= chunk_duration_seconds:
            return [audio_path]

        base_name, _ = os.path.splitext(os.path.basename(audio_path))
        total_duration = int(math.ceil(duration))
        chunk_paths: list[str] = []

        for index, start_second in enumerate(range(0, total_duration, chunk_duration_seconds), start=1):
            chunk_length = min(chunk_duration_seconds, total_duration - start_second)
            chunk_path = os.path.join(
                self.temp_dir,
                f"{base_name}_chunk_{index:03d}.wav",
            )

            try:
                stream = ffmpeg.input(audio_path, ss=start_second, t=chunk_length)
                stream = ffmpeg.output(stream, chunk_path, ac=1, ar="16k", format="wav")
                ffmpeg.run(
                    stream,
                    overwrite_output=True,
                    quiet=True,
                    cmd=self.ffmpeg_binary or "ffmpeg",
                )
            except FileNotFoundError:
                raise RuntimeError(self._missing_binary_message("FFmpeg", "FFMPEG_BINARY"))
            except ffmpeg.Error as e:
                raise RuntimeError(
                    f"FFmpeg failed to split audio into chunks: {e.stderr.decode() if e.stderr else str(e)}"
                )

            chunk_paths.append(chunk_path)

        return chunk_paths

    def get_media_duration(self, file_path: str) -> float:
        """
        Returns duration of media in seconds.
        """
        try:
            probe = ffmpeg.probe(file_path, cmd=self.ffprobe_binary or "ffprobe")
            return float(probe['format']['duration'])
        except FileNotFoundError:
            return 0.0
        except ffmpeg.Error as e:
            pass
        return 0.0

    def get_file_size_bytes(self, file_path: str) -> int | None:
        try:
            return os.path.getsize(file_path)
        except OSError:
            return None

    def cleanup_file(self, file_path: str):
        if os.path.exists(file_path):
            os.remove(file_path)
