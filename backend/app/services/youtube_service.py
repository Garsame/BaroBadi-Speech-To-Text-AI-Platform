import os
import re
import uuid
from typing import Callable, Optional

import yt_dlp


ProgressCallback = Callable[[dict], None]


def sanitize_terminal_text(value: str) -> str:
    ansi_pattern = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
    return ansi_pattern.sub("", value).replace("\r", " ").strip()


class YouTubeService:
    def __init__(self):
        self.download_dir = "temp_youtube"
        os.makedirs(self.download_dir, exist_ok=True)

    def is_valid_url(self, url: str) -> bool:
        return "youtube.com" in url or "youtu.be" in url

    def download_audio(
        self,
        url: str,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> str:
        """
        Downloads media from a YouTube link and reports progress if requested.
        """
        output_template = os.path.join(self.download_dir, f"{uuid.uuid4().hex}.%(ext)s")
        out_path = ""

        def hook(status: dict) -> None:
            if progress_callback:
                progress_callback(status)

        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "quiet": True,
            "retries": 10,
            "fragment_retries": 10,
            "socket_timeout": 30,
            "progress_hooks": [hook],
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(url, download=True)
            out_path = ydl.prepare_filename(info_dict)

        return out_path
