"""Static asset and frontend mounts for the FastAPI entrypoint.

All mounts are created lazily in ``mount_static``/``mount_frontend``; the "/"
frontend mount is registered separately so health/API routes keep priority.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI

from backend.middleware.static_precompressed import PrecompressedStaticFiles

# casuya/apps/platform (Docker WORKDIR /app matches this layout)
_PLATFORM_ROOT = Path(__file__).resolve().parents[2]
_FRONTEND_DIR = _PLATFORM_ROOT / "frontend"


def _find_monorepo_root(platform_root: Path) -> Path | None:
    """Walk up for pnpm-workspace or packages/runtime. None in Railway Docker."""
    cur = platform_root.resolve()
    for _ in range(6):
        if (cur / "pnpm-workspace.yaml").is_file() or (cur / "packages" / "runtime").is_dir():
            return cur
        parent = cur.parent
        if parent == cur:
            break
        cur = parent
    return None


_MONOREPO_ROOT = _find_monorepo_root(_PLATFORM_ROOT)


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

    runtime_dirs = [_FRONTEND_DIR / "static" / "pkg" / "runtime"]
    if _MONOREPO_ROOT is not None:
        runtime_dirs.append(_MONOREPO_ROOT / "packages" / "runtime" / "dist")
    for directory in runtime_dirs:
        if directory.is_dir() and any(directory.glob("casuya-runtime*.js")):
            _mount_precompressed(app, "/static/pkg/runtime", directory, "pkg-casuya-runtime")
            break

    if _MONOREPO_ROOT is not None:
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
