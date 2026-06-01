import glob
import html
import json
import logging
import os
import re
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any
from typing import Callable, Optional

import yt_dlp

from app.core.config import BACKEND_ROOT, load_settings


logger = logging.getLogger("somali_notes.youtube")

ProgressCallback = Callable[[dict], None]


def sanitize_terminal_text(value: str) -> str:
    ansi_pattern = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
    return ansi_pattern.sub("", value).replace("\r", " ").strip()


class YouTubeService:
    BOT_CHALLENGE_MARKERS = (
        "sign in to confirm you're not a bot",
        "too many requests",
        "http error 429",
    )

    def __init__(self):
        self.settings = load_settings()
        self.download_dir = "temp_youtube"
        self.transcript_dir = "temp_youtube_transcripts"
        os.makedirs(self.download_dir, exist_ok=True)
        os.makedirs(self.transcript_dir, exist_ok=True)

    def _resolve_cookie_file(self, cookie_file: str) -> str:
        normalized = os.path.expandvars(os.path.expanduser(cookie_file.strip()))
        candidate = Path(normalized)
        if not candidate.is_absolute():
            candidate = (BACKEND_ROOT / candidate).resolve()

        if not candidate.is_file():
            raise ValueError(
                f"YOUTUBE_COOKIE_FILE points to a missing file: {candidate}"
            )

        return str(candidate)

    def _parse_cookies_from_browser(
        self,
        cookies_from_browser: str,
    ) -> tuple[str, str | None, str | None, str | None]:
        match = re.fullmatch(
            r"""(?x)
            (?P<name>[^+:]+)
            (?:\s*\+\s*(?P<keyring>[^:]+))?
            (?:\s*:\s*(?!:)(?P<profile>.+?))?
            (?:\s*::\s*(?P<container>.+))?
            """,
            cookies_from_browser.strip(),
        )
        if match is None:
            raise ValueError(
                "YOUTUBE_COOKIES_FROM_BROWSER must use the format "
                "BROWSER[+KEYRING][:PROFILE][::CONTAINER]."
            )

        browser_name, keyring, profile, container = match.group(
            "name",
            "keyring",
            "profile",
            "container",
        )
        return (
            browser_name.lower(),
            profile.strip() or None if profile else None,
            keyring.upper() if keyring else None,
            container.strip() or None if container else None,
        )

    def _normalize_youtube_error(self, exc: Exception, action: str) -> RuntimeError:
        message = sanitize_terminal_text(str(exc))
        lowered = message.lower()

        if any(marker in lowered for marker in self.BOT_CHALLENGE_MARKERS):
            return RuntimeError(
                f"YouTube blocked the {action} request with a bot check. "
                "Set YOUTUBE_COOKIES_FROM_BROWSER or YOUTUBE_COOKIE_FILE in backend/.env, "
                "restart the backend, and retry the lecture."
            )

        return RuntimeError(message)

    def _base_ydl_opts(self) -> dict[str, Any]:
        ydl_opts: dict[str, Any] = {
            "quiet": True,
            "socket_timeout": 30,
            "proxy": "",
            "noplaylist": True,
        }

        cookie_file = (self.settings.YOUTUBE_COOKIE_FILE or "").strip()
        if cookie_file:
            ydl_opts["cookiefile"] = self._resolve_cookie_file(cookie_file)

        cookies_from_browser = (self.settings.YOUTUBE_COOKIES_FROM_BROWSER or "").strip()
        if cookies_from_browser:
            ydl_opts["cookiesfrombrowser"] = self._parse_cookies_from_browser(
                cookies_from_browser
            )

        return ydl_opts

    def is_valid_url(self, url: str) -> bool:
        return "youtube.com" in url or "youtu.be" in url

    def get_video_metadata(self, url: str) -> dict[str, Any]:
        ydl_opts = {
            **self._base_ydl_opts(),
            "skip_download": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(url, download=False)
        except Exception as exc:
            raise self._normalize_youtube_error(exc, "metadata lookup") from exc

        return {
            "title": str(info_dict.get("title") or "").strip(),
            "duration_seconds": int(info_dict.get("duration") or 0),
            "is_live": bool(
                info_dict.get("is_live") or info_dict.get("live_status") == "is_live"
            ),
        }

    def get_video_title(self, url: str) -> str:
        metadata = self.get_video_metadata(url)
        title = str(metadata["title"] or "").strip()
        if not title:
            raise ValueError("Could not retrieve a title from the YouTube video.")

        return title

    def _temp_file_token(self, lecture_id: Optional[int] = None) -> str:
        token = uuid.uuid4().hex
        if lecture_id is None:
            return token

        return f"lecture_{lecture_id}_{token}"

    def download_audio(
        self,
        url: str,
        progress_callback: Optional[ProgressCallback] = None,
        lecture_id: Optional[int] = None,
    ) -> str:
        """
        Downloads media from a YouTube link and reports progress if requested.
        """
        output_template = os.path.join(
            self.download_dir,
            f"{self._temp_file_token(lecture_id)}.%(ext)s",
        )
        out_path = ""

        def hook(status: dict) -> None:
            if progress_callback:
                progress_callback(status)

        ydl_opts = {
            **self._base_ydl_opts(),
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "retries": 10,
            "fragment_retries": 10,
            "progress_hooks": [hook],
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(url, download=True)
                out_path = ydl.prepare_filename(info_dict)
        except Exception as exc:
            raise self._normalize_youtube_error(exc, "media download") from exc

        return out_path

    def _parse_timestamp_seconds(self, value: str | None) -> float:
        if not value:
            return 0.0

        cleaned = value.strip().replace(",", ".")
        if not cleaned:
            return 0.0

        if cleaned.endswith("s"):
            try:
                return float(cleaned[:-1])
            except ValueError:
                return 0.0

        try:
            return float(cleaned)
        except ValueError:
            pass

        try:
            total = 0.0
            for part in cleaned.split(":"):
                total = (total * 60) + float(part)
            return total
        except ValueError:
            return 0.0

    def _normalize_caption_text(self, value: str) -> str:
        cleaned = html.unescape(value or "")
        cleaned = re.sub(r"<[^>]+>", " ", cleaned)
        cleaned = cleaned.replace("\u200b", " ").replace("\ufeff", " ")
        cleaned = re.sub(r"\s+", " ", cleaned).strip()

        if not cleaned:
            return ""

        if cleaned.lower() in {"[music]", "(music)", "[applause]", "(applause)"}:
            return ""

        return cleaned

    def _extract_vtt_or_srt_duration(self, text: str) -> float:
        max_end = 0.0

        for match in re.finditer(
            r"(?P<start>\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?)\s*-->\s*(?P<end>\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?)",
            text,
        ):
            max_end = max(max_end, self._parse_timestamp_seconds(match.group("end")))

        return max_end

    def _parse_vtt_or_srt(self, text: str) -> str:
        lines: list[str] = []
        seen: set[str] = set()

        for raw_line in text.splitlines():
            stripped = raw_line.strip()
            if not stripped:
                continue
            if stripped == "WEBVTT":
                continue
            if "-->" in stripped:
                continue
            if stripped.isdigit():
                continue

            cleaned = self._normalize_caption_text(stripped)
            if not cleaned:
                continue
            if cleaned in seen:
                continue

            seen.add(cleaned)
            lines.append(cleaned)

        return "\n".join(lines).strip()

    def _extract_json3_duration(self, text: str) -> float:
        payload = json.loads(text)
        max_end = 0.0

        for event in payload.get("events", []):
            start_seconds = float(event.get("tStartMs") or 0) / 1000
            duration_seconds = float(event.get("dDurationMs") or 0) / 1000
            max_end = max(max_end, start_seconds + duration_seconds)

        return max_end

    def _parse_json3(self, text: str) -> str:
        payload = json.loads(text)
        lines: list[str] = []
        previous_line = ""

        for event in payload.get("events", []):
            segments = event.get("segs") or []
            raw_text = "".join(str(segment.get("utf8", "")) for segment in segments)
            cleaned = self._normalize_caption_text(raw_text)
            if not cleaned:
                continue
            if cleaned == previous_line:
                continue

            previous_line = cleaned
            lines.append(cleaned)

        return "\n".join(lines).strip()

    def _extract_xml_duration(self, text: str) -> float:
        root = ET.fromstring(text)
        max_end = 0.0

        for element in root.iter():
            tag_name = element.tag.split("}")[-1].lower()
            if tag_name not in {"p", "text"}:
                continue

            start_seconds = self._parse_timestamp_seconds(
                element.attrib.get("start") or element.attrib.get("begin")
            )
            duration_seconds = self._parse_timestamp_seconds(element.attrib.get("dur"))
            end_seconds = self._parse_timestamp_seconds(element.attrib.get("end"))
            computed_end = end_seconds or (start_seconds + duration_seconds)
            max_end = max(max_end, computed_end)

        return max_end

    def _parse_xml_captions(self, text: str) -> str:
        root = ET.fromstring(text)
        lines: list[str] = []
        previous_line = ""

        for element in root.iter():
            tag_name = element.tag.split("}")[-1].lower()
            if tag_name not in {"p", "text"}:
                continue

            raw_text = " ".join(part.strip() for part in element.itertext() if part.strip())
            cleaned = self._normalize_caption_text(raw_text)
            if not cleaned:
                continue
            if cleaned == previous_line:
                continue

            previous_line = cleaned
            lines.append(cleaned)

        return "\n".join(lines).strip()

    def _extract_caption_duration(self, file_path: str) -> float:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as caption_file:
            content = caption_file.read()

        extension = os.path.splitext(file_path)[1].lower()

        try:
            if extension == ".json3":
                return self._extract_json3_duration(content)
            if extension in {".xml", ".ttml", ".srv3", ".srv2", ".srv1"}:
                return self._extract_xml_duration(content)
            return self._extract_vtt_or_srt_duration(content)
        except Exception:
            logger.warning(
                "Failed to derive caption duration from %s.",
                file_path,
                exc_info=True,
            )
            return 0.0

    def _parse_caption_file(self, file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as caption_file:
            content = caption_file.read()

        extension = os.path.splitext(file_path)[1].lower()

        if extension == ".json3":
            return self._parse_json3(content)
        if extension in {".xml", ".ttml", ".srv3", ".srv2", ".srv1"}:
            return self._parse_xml_captions(content)
        return self._parse_vtt_or_srt(content)

    def download_transcript_bundle(
        self,
        url: str,
        lecture_id: Optional[int] = None,
    ) -> Optional[dict[str, Any]]:
        token = self._temp_file_token(lecture_id)
        output_template = os.path.join(self.transcript_dir, token)
        info_dict: dict[str, Any] = {}
        ydl_opts = {
            **self._base_ydl_opts(),
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": [
                "en",
                "en-US",
                "en-GB",
                "en-CA",
                "en-AU",
                "en.*",
            ],
            "subtitlesformat": "json3/vtt/best",
            "outtmpl": f"{output_template}.%(ext)s",
        }

        subtitle_files: list[str] = []

        try:
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info_dict = ydl.extract_info(url, download=True) or {}
            except Exception as exc:
                raise self._normalize_youtube_error(exc, "caption download") from exc

            subtitle_files = sorted(
                glob.glob(f"{output_template}*.json3")
                + glob.glob(f"{output_template}*.vtt")
                + glob.glob(f"{output_template}*.srt")
                + glob.glob(f"{output_template}*.xml")
                + glob.glob(f"{output_template}*.ttml")
                + glob.glob(f"{output_template}*.srv1")
                + glob.glob(f"{output_template}*.srv2")
                + glob.glob(f"{output_template}*.srv3")
            )

            for subtitle_file in subtitle_files:
                parsed_text = self._parse_caption_file(subtitle_file)
                if parsed_text:
                    detected_duration = int(info_dict.get("duration") or 0)
                    if detected_duration <= 0:
                        detected_duration = int(
                            round(self._extract_caption_duration(subtitle_file))
                        )

                    return {
                        "text": parsed_text,
                        "duration_seconds": detected_duration,
                        "title": str(info_dict.get("title") or "").strip(),
                    }

            return None
        finally:
            for subtitle_file in subtitle_files:
                if os.path.exists(subtitle_file):
                    os.remove(subtitle_file)

    def download_transcript(
        self,
        url: str,
        lecture_id: Optional[int] = None,
    ) -> Optional[str]:
        transcript_bundle = self.download_transcript_bundle(
            url,
            lecture_id=lecture_id,
        )
        if not transcript_bundle:
            return None

        return str(transcript_bundle.get("text") or "").strip() or None
