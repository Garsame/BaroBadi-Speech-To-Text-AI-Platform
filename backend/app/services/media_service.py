import os
import shutil

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

    def cleanup_file(self, file_path: str):
        if os.path.exists(file_path):
            os.remove(file_path)
