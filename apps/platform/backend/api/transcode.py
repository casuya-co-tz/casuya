"""Video transcoding API — converts uploaded videos to HLS adaptive streams.

POST /uploads/{filename}/transcode — trigger HLS transcoding
GET  /uploads/hls/{video_id}/master.m3u8 — serve master playlist
GET  /uploads/hls/{video_id}/{rendition}/index.m3u8 — serve rendition playlist
GET  /uploads/hls/{video_id}/{rendition}/{segment} — serve TS segments
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse

from backend.config.settings import get_settings
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.services.transcode_service import (
    delete_hls,
    get_hls_manifest,
    transcode_to_hls,
)
from pathlib import Path

router = APIRouter(tags=["transcode"])
settings = get_settings()


@router.post("/uploads/{filename:path}/transcode")
@router.post("/uploads/{filename:path}/transcode/")
async def trigger_transcode(
    filename: str,
    current_user=Depends(require_role("admin")),
):
    """Trigger HLS transcoding for an uploaded video.

    Finds the source file in storage, runs ffmpeg to generate 360p/480p/720p
    renditions, and returns the HLS manifest URL.
    """
    root = Path(settings.storage_root)
    source = None
    for kind_dir in root.iterdir() if root.exists() else []:
        if not kind_dir.is_dir():
            continue
        target = kind_dir / filename
        if target.exists() and target.is_file():
            source = target
            break

    if not source:
        raise HTTPException(status_code=404, detail="Video file not found")

    try:
        result = transcode_to_hls(source)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return result


@router.get("/uploads/hls/{video_id}/master.m3u8")
async def serve_master_playlist(video_id: str):
    """Serve the HLS master playlist for a transcoded video."""
    manifest = get_hls_manifest(video_id)
    if not manifest:
        raise HTTPException(status_code=404, detail="HLS manifest not found")

    master_path = Path(settings.storage_root) / "hls" / video_id / "master.m3u8"
    return FileResponse(
        master_path,
        media_type="application/vnd.apple.mpegurl",
        headers={
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/uploads/hls/{video_id}/{rendition}/index.m3u8")
async def serve_rendition_playlist(video_id: str, rendition: str):
    """Serve a rendition playlist (e.g. 360p/index.m3u8)."""
    playlist_path = Path(settings.storage_root) / "hls" / video_id / rendition / "index.m3u8"
    if not playlist_path.exists():
        raise HTTPException(status_code=404, detail="Rendition not found")

    return FileResponse(
        playlist_path,
        media_type="application/vnd.apple.mpegurl",
        headers={
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/uploads/hls/{video_id}/{rendition}/{segment}")
async def serve_segment(video_id: str, rendition: str, segment: str):
    """Serve an individual TS segment file."""
    seg_path = Path(settings.storage_root) / "hls" / video_id / rendition / segment
    if not seg_path.exists():
        raise HTTPException(status_code=404, detail="Segment not found")

    return FileResponse(
        seg_path,
        media_type="video/mp2t",
        headers={
            "Cache-Control": "public, max-age=86400, immutable",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.delete("/uploads/hls/{video_id}")
@router.delete("/uploads/hls/{video_id}/")
async def delete_hls_video(
    video_id: str,
    current_user=Depends(require_role("admin")),
):
    """Delete all HLS files for a transcoded video."""
    deleted = delete_hls(video_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="HLS files not found")
    return {"deleted": video_id}
