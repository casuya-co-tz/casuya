"""Static asset and frontend mounts for the FastAPI entrypoint.

All mounts are created lazily in ``mount_static``/``mount_frontend``; the "/"
frontend mount is registered separately so health/API routes keep priority.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.middleware.static_precompressed import PrecompressedStaticFiles

# casuya/apps — same folder the original entrypoint resolved via parents[2].
_REPO_ROOT = Path(__file__).resolve().parents[3]

# casuya/apps/platform/frontend — served at "/" with html=True.
_FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"


def mount_static(app: FastAPI, settings) -> None:
    """Mount lesson packages, shared lib, HLS and built JS package dists."""

    # Mount lesson packages as static files for direct CDN/reverse-proxy serving
    pkg_dir = Path(settings.storage_root) / "lesson-packages"
    pkg_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/static/lessons", StaticFiles(directory=str(pkg_dir)), name="lesson-packages")

    # Mount shared library files (KaTeX, etc.) for offline-first lesson rendering
    lib_dir = Path(settings.storage_root) / "lib"
    lib_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/static/lib", StaticFiles(directory=str(lib_dir)), name="shared-lib")

    # Mount HLS transcoded videos for adaptive streaming (360p/480p/720p renditions)
    hls_dir = Path(settings.storage_root) / "hls"
    hls_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads/hls", StaticFiles(directory=str(hls_dir)), name="hls-videos")

    # Mount built client-side Casuya packages so the web app can load them directly.
    # These point at the monorepo package dist folders; when absent they are skipped.
    # Single-package dist folders.
    _pkg_mounts = [
        ("casuya-runtime", "dist", "/static/pkg/runtime"),
        ("casuya-blackboard", "dist", "/static/pkg/blackboard"),
        ("casuya-editor", "dist", "/static/pkg/editor"),
        ("casuya-math", "dist", "/static/pkg/math"),
    ]
    for _pkg, _sub, _route in _pkg_mounts:
        _d = _REPO_ROOT / _pkg / _sub
        if _d.is_dir():
            app.mount(_route, StaticFiles(directory=str(_d)), name=f"pkg-{_pkg}")

    # casuya-design-system is a pnpm sub-workspace; mount each built sub-package.
    _ds_root = _REPO_ROOT / "casuya-design-system" / "packages"
    if _ds_root.is_dir():
        for _ds_pkg in _ds_root.iterdir():
            if _ds_pkg.is_dir():
                _dd = _ds_pkg / "dist"
                if _dd.is_dir():
                    _route = f"/static/pkg/design-system/{_ds_pkg.name}"
                    app.mount(_route, StaticFiles(directory=str(_dd)), name=f"pkg-design-system-{_ds_pkg.name}")


def mount_frontend(app: FastAPI) -> None:
    """Serve the static frontend (HTML/JS/CSS) from the repo's frontend/ directory.

    Mounted LAST so API routes keep priority; html=True lets "/" return index.html.
    This makes the API and the web app share one origin (no CORS, works on Koyeb).
    """
    if _FRONTEND_DIR.is_dir():
        # PrecompressedStaticFiles serves existing `.gz` assets with
        # Content-Encoding: gzip when the client supports it, plus sane cache
        # headers, so large bundles transfer 60-80% smaller on 2G/3G.
        app.mount("/", PrecompressedStaticFiles(directory=str(_FRONTEND_DIR), html=True), name="frontend")