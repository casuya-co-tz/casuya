"""Catalog walk + CLI entry for the reference-library importer."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from ._setup import logger, DEFAULT_API, DEFAULT_TOKEN, DEFAULT_CACHE_DIR, CATALOGS
from .workers import _fetch, _cache_ids, _ellipsis, _import_document


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

    # Seed the educator-verified bundled library (committed lesson content) so
    # the reference docs are complete even when the live catalog is unreachable
    # (offline/offline-first deployments). Idempotent and additive.
    try:
        from .seed_reference_library_local import run as seed_bundled

        _l_inserted, _l_replaced, _l_schemes, _l_schemes_replaced, _l_purged = seed_bundled(db)
        if _l_inserted or _l_replaced or _l_schemes or _l_schemes_replaced or _l_purged:
            logger.info(
                "bundled reference library: lessons inserted=%d replaced=%d "
                "schemes inserted=%d replaced=%d online duplicates purged=%d",
                _l_inserted,
                _l_replaced,
                _l_schemes,
                _l_schemes_replaced,
                _l_purged,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("bundled reference library seed failed: %s", exc)

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