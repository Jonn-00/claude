"""Download shortlisted clips with yt-dlp, reusing the browser login cookies."""

from __future__ import annotations

import random
import sys
import time
from pathlib import Path

from .models import Clip


def download_clip(clip: Clip, out_dir: Path, cookies: Path | None) -> Path:
    from yt_dlp import YoutubeDL

    out_dir.mkdir(parents=True, exist_ok=True)
    opts = {
        "outtmpl": str(out_dir / "%(uploader)s_%(id)s.%(ext)s"),
        "format": "bv*+ba/b",
        "merge_output_format": "mp4",
        "quiet": True,
        "noprogress": True,
        "retries": 3,
        "no_warnings": True,
    }
    if cookies and cookies.exists():
        opts["cookiefile"] = str(cookies)
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(clip.url, download=True)
        return Path(ydl.prepare_filename(info))


def download_many(clips: list[Clip], out_dir: Path, cookies: Path | None, on_done) -> tuple[int, int]:
    ok = failed = 0
    for i, clip in enumerate(clips):
        try:
            path = download_clip(clip, out_dir, cookies)
            on_done(clip, path)
            ok += 1
            print(f"  ✓ {clip.id} -> {path.name}")
        except Exception as e:  # yt-dlp raises a variety of errors per extractor change
            failed += 1
            print(f"  ✗ {clip.id}: {str(e).splitlines()[0][:140]}", file=sys.stderr)
        if i < len(clips) - 1:
            time.sleep(random.uniform(2, 5))  # don't hammer the CDN
    return ok, failed
