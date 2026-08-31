"""Video transcoding service — converts uploaded videos to HLS adaptive streams.

Uses ffmpeg to generate multiple renditions at different resolutions/bitrates
so that students on 2G/3G get lower quality automatically while WiFi users
get HD. Output is stored as:

  storage/hls/{video_id}/
    master.m3u8          — master playlist referencing all renditions
    360p/index.m3u8      — 360p rendition playlist
    360p/segment_000.ts  — transport stream segments
    480p/index.m3u8
    720p/index.m3u8

Requires ffmpeg installed on the host (add to Dockerfile: RUN apt-get install -y ffmpeg).
"""

from __future__ import annotations

import logging
import subprocess
import uuid
from pathlib import Path

from backend.config.settings import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Rendition profiles: (label, width, height, maxrate, bufsize)
RENDITIONS = [
    ("360p", 640, 360, "800k", "1200k"),
    ("480p", 854, 480, "1400k", "2100k"),
    ("720p", 1280, 720, "2800k", "4200k"),
]


def _hls_dir(video_id: str) -> Path:
    return Path(settings.storage_root) / "hls" / video_id


def _has_ffmpeg() -> bool:
    """Check if ffmpeg is available on the system."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def transcode_to_hls(
    input_path: str | Path,
    video_id: str | None = None,
) -> dict:
    """Transcode a video file into HLS adaptive streams.

    Args:
        input_path: Path to the source video file (mp4, webm, etc.)
        video_id: Optional ID for the output directory. Auto-generated if omitted.

    Returns:
        dict with video_id, master_playlist path, and rendition info.
    """
    input_path = Path(input_path)
    if not input_path.exists():
        raise FileNotFoundError(f"Source video not found: {input_path}")

    if not _has_ffmpeg():
        raise RuntimeError(
            "ffmpeg is not installed. Add to Dockerfile: RUN apt-get update && apt-get install -y ffmpeg"
        )

    video_id = video_id or uuid.uuid4().hex[:12]
    output_dir = _hls_dir(video_id)
    output_dir.mkdir(parents=True, exist_ok=True)

    master_playlist = output_dir / "master.m3u8"
    rendition_playlists = []

    for label, width, height, maxrate, bufsize in RENDITIONS:
        rendition_dir = output_dir / label
        rendition_dir.mkdir(exist_ok=True)
        playlist_path = rendition_dir / "index.m3u8"
        segment_pattern = str(rendition_dir / "segment_%03d.ts")

        cmd = [
            "ffmpeg",
            "-i", str(input_path),
            "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
            "-c:v", "libx264",
            "-preset", "fast",
            "-g", "48",
            "-keyint_min", "48",
            "-sc_threshold", "0",
            "-b:v", maxrate,
            "-maxrate", maxrate,
            "-bufsize", bufsize,
            "-c:a", "aac",
            "-b:a", "96k",
            "-ac", "2",
            "-hls_time", "4",
            "-hls_playlist_type", "vod",
            "-hls_segment_filename", segment_pattern,
            "-hls_segment_type", "mpegts",
            str(playlist_path),
        ]

        logger.info("Transcoding %s rendition for %s", label, video_id)
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600,  # 10 min max per rendition
            )
            if result.returncode != 0:
                logger.error("ffmpeg failed for %s: %s", label, result.stderr[-500:] if result.stderr else "no stderr")
                continue
        except subprocess.TimeoutExpired:
            logger.error("ffmpeg timed out for %s rendition of %s", label, video_id)
            continue

        # Calculate bandwidth for the master playlist
        bandwidth = int(maxrate.replace("k", "")) * 1000
        rendition_playlists.append({
            "label": label,
            "width": width,
            "height": height,
            "bandwidth": bandwidth,
            "playlist": f"{label}/index.m3u8",
        })

    if not rendition_playlists:
        raise RuntimeError(f"All ffmpeg renditions failed for {input_path}")

    # Write master playlist
    master_lines = ["#EXTM3U", "#EXT-X-VERSION:3"]
    for r in sorted(rendition_playlists, key=lambda x: x["bandwidth"]):
        master_lines.append(
            f'#EXT-X-STREAM-INF:BANDWIDTH={r["bandwidth"]},RESOLUTION={r["width"]}x{r["height"]},NAME="{r["label"]}"'
        )
        master_lines.append(r["playlist"])

    master_playlist.write_text("\n".join(master_lines) + "\n", encoding="utf-8")

    return {
        "video_id": video_id,
        "master_playlist": f"/uploads/hls/{video_id}/master.m3u8",
        "renditions": rendition_playlists,
    }


def get_hls_manifest(video_id: str) -> dict | None:
    """Return the HLS manifest for a transcoded video, or None if not found."""
    output_dir = _hls_dir(video_id)
    master = output_dir / "master.m3u8"
    if not master.exists():
        return None
    return {
        "video_id": video_id,
        "master_playlist": f"/uploads/hls/{video_id}/master.m3u8",
    }


def delete_hls(video_id: str) -> bool:
    """Delete all HLS files for a video."""
    import shutil
    output_dir = _hls_dir(video_id)
    if output_dir.exists():
        shutil.rmtree(output_dir)
        return True
    return False
