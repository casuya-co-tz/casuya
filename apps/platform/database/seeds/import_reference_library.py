"""Import the public reference library (official lessons + schemes) from the
reference platform (clickonlineacademy.ac.tz) into ``reference_docs``.

Extracts the FULL catalog — every lesson plan and scheme of work — and stores
each document's complete detail payload (competences, activities, per-stage
teaching structures, assessment criteria, etc.) so teachers can browse/search
them as grounding references when generating their own plans.

Usage (from apps/platform):

    python -m database.seeds.import_reference_library                # full import
    python -m database.seeds.import_reference_library --limit 5      # pilot
    python -m database.seeds.import_reference_library --cache-dir ... # custom cache

Configuration (environment):
    REFERENCE_API_BASE   default https://api.clickonlineacademy.ac.tz/v1
    REFERENCE_AUTH_TOKEN default 2ec26ad9-... (embedded public app token)

The script is idempotent and resumable: a document already imported (or already
cached) is skipped. Raw detail payloads are cached under ``cache_dir`` so a run
can be re-played offline without re-hitting the network.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import time
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("import_reference_library")

DEFAULT_API = "https://api.clickonlineacademy.ac.tz/v1"
DEFAULT_TOKEN = "2ec26ad9-e039-445e-915e-a482dc6f5e3b"

DEFAULT_CACHE_DIR = str(Path(__file__).resolve().parent.parent.parent / "data" / "reference_library_cache")

CATALOGS = {
    "lesson_plan": ("/lesson_plan/get-all-lesson-plan", "/lesson_plan/get-lesson-plan-by-plan-id/{id}"),
    "scheme_of_work": ("/scheme_of_work/get-all-scheme-of-work", "/scheme_of_work/get-scheme-of-work-by-scheme-of-work-id/{id}"),
}

_KIND_ALIASES = {"lesson_plan": "lesson plan", "scheme_of_work": "scheme of work"}


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


def run(db, *, limit: int | None = None, cache_dir: str = DEFAULT_CACHE_DIR,
        api_base: str | None = None, auth_token: str | None = None,
        check_existing: bool = True, offline: bool = False) -> tuple[int, int]:
    """Import all reference docs. Returns ``(inserted, replaced, skipped)``.

    In ``offline`` mode the compiled catalog is reconstructed from the cache
    directory, so a freshly-deployed instance can seed the reference library
    with no live network access. Otherwise the live catalog is fetched and any
    missing detail payloads are downloaded into the cache on demand.
    """
    cache_path = Path(cache_dir)
    cache_path.mkdir(parents=True, exist_ok=True)

    import httpx

    api_base = (api_base or os.getenv("REFERENCE_API_BASE") or DEFAULT_API).rstrip("/")
    token = auth_token or os.getenv("REFERENCE_AUTH_TOKEN") or DEFAULT_TOKEN

    inserted = 0
    replaced = 0
    skipped = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "accept": "application/json",
        "AuthToken": token,
        "Origin": "https://clickonlineacademy.ac.tz",
        "Referer": "https://clickonlineacademy.ac.tz/",
    }

    with httpx.Client(timeout=120.0, follow_redirects=True, headers=headers) as client:
        for doc_type, (list_path, detail_path) in CATALOGS.items():
            if offline:
                entries = [{"id": sid} for sid in _cache_ids(cache_path, doc_type)]
                logger.info("%s: %d cached documents (offline)", doc_type, len(entries))
            else:
                logger.info("Fetching %s catalog ...", doc_type)
                try:
                    catalog = _fetch(client, f"{api_base}{list_path}")
                except Exception as exc:  # noqa: BLE001
                    logger.warning("catalog %s failed (%s); falling back to cached docs", doc_type, exc)
                    entries = [{"id": sid} for sid in _cache_ids(cache_path, doc_type)]
                else:
                    entries = catalog.get("data") or []
                logger.info("%s: %d entries", doc_type, len(entries))

            for entry in entries:
                if limit is not None and (inserted + replaced + skipped) >= limit:
                    break
                source_id = str(entry.get("id"))
                if not source_id:
                    continue

                before_hash = None
                if check_existing:
                    from backend.services.reference_library_service import get_reference_doc_by_source

                    existing = get_reference_doc_by_source(db, doc_type, source_id)
                    if existing is not None:
                        before_hash = (existing.content, existing.title, existing.subject_slug,
                                       existing.form_level, existing.standard)

                result = _import_document(
                    db, client, doc_type, source_id, list_path, detail_path, api_base,
                    cache_path, check_existing,
                    title_hint=entry.get("title") or "",
                    standard_hint=entry.get("standard") or "",
                )

                if result == 1:
                    if before_hash is not None:
                        replaced += 1
                    else:
                        inserted += 1
                else:
                    skipped += 1

                done = inserted + replaced + skipped
                if done % 25 == 0:
                    logger.info("progress(%s): %s", doc_type, _ellipsis(
                        f"inserted={inserted} replaced={replaced} skipped={skipped}"))
                    db.expire_all()

    return inserted, replaced, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Import reference library (lessons + schemes)")
    parser.add_argument("--limit", type=int, default=None, help="stop after N documents (for pilots)")
    parser.add_argument("--api-base", default=None, help="reference API base URL")
    parser.add_argument("--token", default=None, help="reference API auth token")
    parser.add_argument("--cache-dir", default=DEFAULT_CACHE_DIR, help="raw detail JSON cache dir")
    parser.add_argument("--no-check-existing", action="store_true", help="do not skip already-imported docs")
    parser.add_argument("--offline", action="store_true",
                        help="seed from the committed cache only (no live network)")
    args = parser.parse_args()

    from backend.config.database import get_db, init_db

    init_db()
    db = next(get_db())
    try:
        inserted, replaced, skipped = run(
            db,
            limit=args.limit,
            cache_dir=args.cache_dir,
            api_base=args.api_base,
            auth_token=args.token,
            check_existing=not args.no_check_existing,
            offline=args.offline,
        )
    finally:
        db.close()
    logger.info("DONE: inserted=%d replaced=%d skipped=%d", inserted, replaced, skipped)


if __name__ == "__main__":
    main()
