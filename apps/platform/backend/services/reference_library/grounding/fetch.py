"""Reference library — best-match reference document fetch for grounding."""

from __future__ import annotations

import json

from backend.models.reference_doc import ReferenceDoc

from .candidates import _doc_content_text, _fetch_grounding_candidates


def fetch_reference_grounding(
    subject_slug: str,
    form_level: int | None,
    topic: str | None = None,
    doc_type: str | None = None,
) -> dict | None:
    """Return the best-matching reference document content for grounding.

    Opens its own read-only session so offline generators can call it without
    threading a ``Session`` through. Best-effort and side-effect free: returns
    ``None`` when no database, table or matching row is available, so callers
    fall back to their generic content rather than failing.

    The best document wins an in-memory score: a topic/subtopic appearing in
    the title scores highest, and the same text appearing anywhere inside the
    document's teaching content (specific activities, stage cells, etc.) selects
    the correct single-lesson plan rather than the first row of a chapter.
    """
    try:
        from backend.config.database import get_db

        _gen = get_db()
        db = next(_gen)
    except Exception:
        return None
    try:
        docs = _fetch_grounding_candidates(db, subject_slug, form_level, doc_type)
        if not docs:
            return None

        needle = (topic or "").strip().lower()
        haystacks = {doc.id: _doc_content_text(doc).lower() for doc in docs}

        def _score(doc: ReferenceDoc) -> int:
            score = 0
            if doc_type and (doc.doc_type or "") == doc_type:
                score += 1
            if not needle:
                return score
            title = (doc.title or "").lower()
            if needle in title:
                return score + 3
            if needle in haystacks.get(doc.id, ""):
                score += 2
            return score

        best = max(docs, key=_score)
        try:
            content = json.loads(best.content)
        except (TypeError, ValueError):
            content = {}
        return {
            "doc_type": best.doc_type,
            "title": best.title,
            "standard": best.standard,
            "source_id": best.source_id,
            "content": content,
        }
    finally:
        _gen.close()