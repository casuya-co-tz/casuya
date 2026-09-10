"""HTTP, cache and per-document workers for the reference-library importer."""

from __future__ import annotations

import json
import time
from pathlib import Path

from ._setup import logger


def _fetch(client, url: str) -> dict:
    resp = client.get(url)
    resp.raise_for_status()
    return resp.json()


def _upsert_doc(db, doc_type: str, source_id: str, meta: dict, content: dict) -> bool:
    from backend.models.reference_doc import ReferenceDoc
    from backend.services.reference_library_service import get_reference_doc_by_source

    existing = get_reference_doc_by_source(db, doc_type, str(source_id))
    if existing is not None:
        updated = False
        if existing.content != json.dumps(content, ensure_ascii=False):
            existing.content = json.dumps(content, ensure_ascii=False)
            updated = True
        for key in ("title", "subject_name", "subject_slug", "form_level", "standard", "source_url"):
            if getattr(existing, key) != meta.get(key):
                setattr(existing, key, meta.get(key))
                updated = True
        if updated:
            db.commit()
            return True
        return False

    doc = ReferenceDoc(
        doc_type=doc_type,
        source_id=str(source_id),
        source_url=meta.get("source_url"),
        title=meta.get("title") or "",
        subject_name=meta.get("subject_name"),
        subject_slug=meta.get("subject_slug"),
        form_level=meta.get("form_level"),
        standard=meta.get("standard"),
        content=json.dumps(content, ensure_ascii=False),
    )
    db.add(doc)
    db.commit()
    return True


def _parse_lesson(meta: dict) -> dict:
    return {
        "title": meta.get("title") or "",
        "standard": meta.get("standard") or "",
        "subject_id": meta.get("subject_id"),
        "header": meta.get("header"),
        "document": meta.get("document"),
        "plan_details": meta.get("plan_details") or [],
    }


def _parse_scheme(meta: dict) -> dict:
    return {
        "title": meta.get("title") or "",
        "standard": meta.get("standard") or "",
        "subject_id": meta.get("subject_id"),
        "scheme_of_work_details": meta.get("scheme_of_work_details") or [],
        "document": meta.get("document"),
    }


def _cache_ids(cache_path: Path, doc_type: str) -> list[str]:
    """Enumerate cached document ids for a doc_type without any network."""
    ids: list[str] = []
    prefix = f"{doc_type}_"
    if not cache_path.is_dir():
        return ids
    for path in cache_path.glob(f"{prefix}*.json"):
        ids.append(path.stem[len(prefix):])
    ids.sort(key=lambda s: int(s) if s.isdigit() else -1)
    return ids


def _ellipsis(text: str, limit: int = 70) -> str:
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _import_document(db, client, doc_type: str, source_id: str,
                     list_path: str, detail_path: str, api_base: str,
                     cache_path: Path, check_existing: bool,
                     title_hint: str = "", standard_hint: str = "") -> int:
    """Import a single document. Returns inserted (1), replaced (1) or skipped (0)."""
    from backend.services.reference_library_service import get_reference_doc_by_source, parse_metadata

    if check_existing and get_reference_doc_by_source(db, doc_type, source_id) is not None:
        return 0

    json_path = cache_path / f"{doc_type}_{source_id}.json"
    if json_path.exists():
        with open(json_path, encoding="utf-8") as fh:
            detail = json.load(fh)
    else:
        try:
            detail = _fetch(client, f"{api_base}{detail_path.format(id=source_id)}")
        except Exception as exc:  # noqa: BLE001
            logger.warning("fetch %s %s failed: %s", doc_type, source_id, exc)
            time.sleep(1.0)
            return 0
        with open(json_path, "w", encoding="utf-8") as fh:
            json.dump(detail, fh, ensure_ascii=False)

    data = detail.get("data") or {}
    title = data.get("title") or title_hint or ""
    standard = data.get("standard") or standard_hint or ""
    content = _parse_lesson(data) if doc_type == "lesson_plan" else _parse_scheme(data)

    slug, form_level, subject_name = parse_metadata(title, standard)
    meta = {
        "title": title,
        "standard": standard,
        "source_url": f"{api_base}{detail_path.format(id=source_id)}",
        "subject_slug": slug,
        "form_level": form_level,
        "subject_name": subject_name,
    }
    return 1 if _upsert_doc(db, doc_type, source_id, meta, content) else 0