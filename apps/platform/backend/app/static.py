"""Static asset and frontend mounts for the FastAPI entrypoint.

All mounts are created lazily in ``mount_static``/``mount_frontend``; the "/"
frontend mount is registered separately so health/API routes keep priority.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI

from backend.middleware.static_precompressed import PrecompressedStaticFiles

# casuya/ (monorepo root)
_MONOREPO_ROOT = Path(__file__).resolve().parents[4]
# casuya/apps/platform
_PLATFORM_ROOT = Path(__file__).resolve().parents[2]
_FRONTEND_DIR = _PLATFORM_ROOT / "frontend"


def _mount_precompressed(app: FastAPI, route: str, directory: Path, name: str, html: bool = False) -> bool:
    if not directory.is_dir():
        return False
    app.mount(
        route,
        PrecompressedStaticFiles(directory=str(directory), html=html),
        name=name,
    )
    return True


def mount_static(app: FastAPI, settings) -> None:
    """Mount lesson packages, shared lib, HLS and built JS package dists."""

    pkg_dir = Path(settings.storage_root) / "lesson-packages"
    pkg_dir.mkdir(parents=True, exist_ok=True)
    _mount_precompressed(app, "/static/lessons", pkg_dir, "lesson-packages")

    # Vendored KaTeX / hls.js live in the frontend tree (not storage/lib).
    frontend_lib = _FRONTEND_DIR / "static" / "lib"
    storage_lib = Path(settings.storage_root) / "lib"
    if not _mount_precompressed(app, "/static/lib", frontend_lib, "shared-lib"):
        storage_lib.mkdir(parents=True, exist_ok=True)
        _mount_precompressed(app, "/static/lib", storage_lib, "shared-lib")

    hls_dir = Path(settings.storage_root) / "hls"
    hls_dir.mkdir(parents=True, exist_ok=True)
    _mount_precompressed(app, "/uploads/hls", hls_dir, "hls-videos")

    for directory in (
        _FRONTEND_DIR / "static" / "pkg" / "runtime",
        _MONOREPO_ROOT / "packages" / "runtime" / "dist",
    ):
        if directory.is_dir() and any(directory.glob("casuya-runtime*.js")):
            _mount_precompressed(app, "/static/pkg/runtime", directory, "pkg-casuya-runtime")
            break

    _pkg_mounts = [
        (_MONOREPO_ROOT / "packages" / "blackboard" / "dist", "/static/pkg/blackboard", "pkg-casuya-blackboard"),
        (_MONOREPO_ROOT / "packages" / "editor" / "dist", "/static/pkg/editor", "pkg-casuya-editor"),
    ]
    for directory, route, name in _pkg_mounts:
        _mount_precompressed(app, route, directory, name)

    _ds_root = _MONOREPO_ROOT / "packages"
    if _ds_root.is_dir():
        for _ds_pkg in _ds_root.iterdir():
            if _ds_pkg.name.startswith("ds-") and (_ds_pkg / "dist").is_dir():
                _route = f"/static/pkg/design-system/{_ds_pkg.name}"
                _mount_precompressed(app, _route, _ds_pkg / "dist", f"pkg-{_ds_pkg.name}")


def mount_frontend(app: FastAPI) -> None:
    """Serve the static frontend (HTML/JS/CSS) from the repo's frontend/ directory.

    Mounted LAST so API routes keep priority; html=True lets "/" return index.html.
    This makes the API and the web app share one origin (no CORS, works on Koyeb).
    """
    _mount_precompressed(app, "/", _FRONTEND_DIR, "frontend", html=True)
