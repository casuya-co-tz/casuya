"""Deterministic offline question generation for one exam-paper section."""

from __future__ import annotations

import random

from .cleaning import _content_lines, _extract_terms, _sentences, _strip_html
from .mcq import _build_mcq, _build_topic_mcq
from .structured import _build_essay, _build_structured


def generate_section_questions_local(
    sec: dict, ctx: dict, count: int, rng: random.Random | None = None
) -> list[dict]:
    """Deterministic offline questions for one section, grounded in lesson text."""
    html = ctx.get("lesson_content") or ""
    text = _strip_html(html)
    sentences = _sentences(text)
    content_lines = _content_lines(html)
    terms = _extract_terms(html, text)
    source_lines = content_lines if content_lines else sentences
    seed = f"{ctx.get('lesson_id') or 'lesson'}|{sec.get('id') or 'X'}"
    rng = rng or random.Random(seed)

    qtype = sec.get("question_type")
    mpq = max(1, int(sec.get("marks_per_question") or 1))
    qs: list[dict] = []
    if qtype == "mcq":
        attempts = 0
        i = 0
        while len(qs) < count and attempts < count * 8:
            attempts += 1
            s = source_lines[i % len(source_lines)] if source_lines else None
            i += 1
            q = _build_mcq(s, terms, rng, len(qs)) if s else None
            if q:
                q["marks"] = mpq
                qs.append(q)
        fallback = 0
        while len(qs) < count and fallback < count * 3:
            q = _build_topic_mcq(ctx, len(qs))
            q["marks"] = mpq
            qs.append(q)
            fallback += 1
    elif qtype == "structured":
        for i in range(count):
            term = terms[i % len(terms)] if terms else "the topic"
            qs.append({"marks": mpq, **_build_structured(term, ctx, i, terms)})
    else:  # essay
        for i in range(count):
            qs.append({"marks": mpq, **_build_essay(ctx, i)})
    return qs