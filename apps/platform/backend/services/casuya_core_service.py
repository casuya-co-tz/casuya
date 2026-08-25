"""Casuya Core integration service.

Compiles, validates, signs and packages HTML lessons using the casuya-core
package, storing the resulting lesson package in the platform's lesson-packages
storage directory (served as static files under /static/lessons).
"""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from backend.config.settings import get_settings


def _storage_dir() -> Path:
    settings = get_settings()
    d = Path(settings.storage_root) / "lesson-packages"
    d.mkdir(parents=True, exist_ok=True)
    return d


def compile_lesson(
    html: str,
    *,
    lesson_id: str | None = None,
    validate: bool = True,
    security: bool = True,
    db: Session | None = None,
) -> dict:
    """Compile raw HTML into a signed Casuya lesson package.

    Returns a dict describing the produced package: id, path, size, integrity_ok.
    When `db` is provided the compiled package is persisted to the database so it
    survives ephemeral filesystem wipes (see backend/services/storage_rehydrate.py).
    """
    from casuya_core import (
        CompilerConfig,
        LessonCompiler,
        generate_signatures,
        verify_package_integrity,
    )

    settings = get_settings()
    cfg = CompilerConfig(
        validate_schema=validate,
        enable_security_validation=security,
        enable_cache=False,
    )
    compiler = LessonCompiler(cfg)

    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "lesson.html"
        src.write_text(html, encoding="utf-8")
        pkg_path = compiler.compile(src, output_name=lesson_id)

        # Optionally (re)sign the package using the platform signing key.
        if settings.casuya_core_signing_key:
            try:
                signatures = generate_signatures(pkg_path.parent)
                integrity = verify_package_integrity(pkg_path, signatures)
            except Exception:
                signatures = {}
                integrity = False
        else:
            integrity = verify_package_integrity(pkg_path)

        dest = _storage_dir() / pkg_path.name
        shutil.copyfile(pkg_path, dest)

        if db is not None and lesson_id:
            from backend.models.lesson import Lesson

            lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
            if lesson is not None:
                try:
                    lesson.package_html = dest.read_text(encoding="utf-8")
                    lesson.package_filename = pkg_path.name
                    db.commit()
                except Exception:
                    db.rollback()

    return {
        "id": pkg_path.stem,
        "package": pkg_path.name,
        "path": f"/static/lessons/{pkg_path.name}",
        "size": dest.stat().st_size,
        "integrity_ok": bool(integrity),
    }


def validate_lesson_html(html: str) -> dict:
    """Validate raw lesson HTML without producing a package.

    Returns {"valid": bool, "errors": [...]}.
    """
    from casuya_core import LessonValidator

    validator = LessonValidator()
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "lesson.html"
        src.write_text(html, encoding="utf-8")
        try:
            from casuya_core.manifest import create_manifest
            from casuya_core.metadata import create_metadata

            metadata = create_metadata(src)
            manifest = create_manifest(src, metadata)
            validator.validate_lesson(src, manifest, metadata)
            return {"valid": True, "errors": []}
        except Exception as exc:  # noqa: BLE001
            return {"valid": False, "errors": [str(exc)]}


def security_scan(html: str) -> dict:
    """Run casuya-core security validation on raw lesson HTML."""
    from casuya_core import SecurityValidator

    sec = SecurityValidator()
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "lesson.html"
        src.write_text(html, encoding="utf-8")
        from casuya_core.manifest import create_manifest
        from casuya_core.metadata import create_metadata

        metadata = create_metadata(src)
        manifest = create_manifest(src, metadata)
        try:
            sec.validate_all(html, manifest, src.parent)
            return {"safe": True, "issues": []}
        except Exception as exc:  # noqa: BLE001
            return {"safe": False, "issues": [str(exc)]}
