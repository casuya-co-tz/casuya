"""AI bridge — prompt/payload construction for question generation, tutoring
and content analysis, with HTML stripping and local fallback builders."""

from __future__ import annotations

import logging
import re

from .client import AiServiceError, _call_ai_service

logger = logging.getLogger(__name__)


# ---------- HTML Stripping ----------


def _strip_html(html: str) -> str:
    """Strip HTML tags, scripts, styles, and decode entities to plain text."""
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<!\-\-[\s\S]*?\-\->", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\\(?:text|mathrm|frac|sqrt|left|right|rightarrow|Rightarrow)\{[^}]*\}", " ", text)
    text = re.sub(r"[\$\\][\s\S]{0,10}?\{[^}]*\}", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_topic_from_text(text: str) -> str:
    """Pull a short topic phrase from plain text (usually the first sentence or heading)."""
    first_line = text.split(".")[0].split(":")[-1].strip()
    words = first_line.split()[:12]
    return " ".join(words) if words else "lesson content"


# ---------- Subject Relevance ----------


_SUBJECT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "mathematics": (
        "math", "algebra", "geometry", "equation", "equations", "calculus", "number",
        "numbers", "probability", "trigonometry", "statistics", "function",
        "functions", "solve", "solving", "measurement", "graph", "graphs", "fraction",
        "fractions", "percent", "percentage", "angle", "angles", "proportion",
        "vector", "vectors", "matrix", "integral", "derivative", "arithmetic", "sum",
        "multiply", "multiplying", "divide", "dividing", "subtract", "subtracting",
        "quadratic", "linear", "exponent", "logarithm", "sequence", "sequences",
        "series", "distance", "speed", "area", "areas", "volume", "integer",
        "integers", "ratio", "ratios", "decimal", "decimals", "range", "mean",
        "median", "mode", "table", "tables", "coordinates", "gradient", "intercept",
        "inequality", "inequalities", "simultaneous", "factor", "factorisation",
        "factorization", "bracket", "brackets", "pythagoras", "sine", "cosine",
        "tangent", "circle", "circles", "triangle", "triangles", "polygon",
        "percentages", "average", "mass", "time", "weight",
    ),
    "chemistry": (
        "chem", "atom", "atoms", "molecule", "molecules", "element", "elements",
        "compound", "compounds", "reaction", "reactions", "acid", "acids", "base",
        "bases", "equilibrium", "bond", "bonds", "bonding", "electron", "electrons",
        "proton", "protons", "neutron", "neutrons", "ion", "ions", "periodic",
        "mole", "moles", "concentration", "solution", "solutions", "titration",
        "gas", "gases", "solid", "solids", "liquid", "liquids", "organic",
        "inorganic", "polymer", "polymers", "chemical", "salt", "salts",
        "carbon", "hydrogen", "oxygen", "nitrogen", "formula", "formulae",
        "symbol", "symbols", "valency", "catalyst", "catalysts", "precipitate",
        "solubility", "boiling", "evaporation", "distillation", "chromatography",
        "electrolysis", "alkali", "alkalis", "oxide", "oxidation", "reduction",
        "exothermic", "endothermic",
    ),
    "physics": (
        "phys", "force", "forces", "mass", "energy", "velocity", "velocities",
        "acceleration", "momentum", "newton", "gravity", "gravitational", "magnet",
        "magnets", "magnetic", "electric", "electrical", "electricity", "current",
        "voltage", "resistance", "wavelength", "frequency", "wave", "waves",
        "sound", "light", "optics", "refraction", "reflection", "lens", "lenses",
        "mirror", "mirrors", "circuit", "circuits", "heat", "temperature",
        "thermodynamic", "work", "power", "pressure", "density", "kinetic",
        "potential", "speed", "motion", "displacement", "projectile", "hooke",
        "ohms", "capacitor", "capacitance", "friction", "electromagnet",
        "electromagnetic", "conductor", "conductors", "insulator", "insulators",
        "transformer", "transformers", "moment", "moments", "weight",
    ),
}

# Stems matched at word-start (catch inflectional forms like oxidation/oxide).
_SUBJECT_STEMS: dict[str, tuple[str, ...]] = {
    "mathematics": ("trigonomet", "geomet", "algeb", "arithmet", "calcul", "probabil", "log", "exponent"),
    "chemistry": ("chem", "oxid", "reduc", "electroly", "titrat"),
    "physics": ("phys", "magnet", "electr", "gravitat", "thermodynam"),
}


def check_subject_relevance(plain_text: str, subject_slug: str) -> str | None:
    """Return a non-empty mismatch reason if the text is clearly not about the subject.

    Non-stem keywords are matched as whole words (`\b...\b`) so substrings like
    "mode" inside "modern" or "sum" inside "summary" do not count, keeping false
    positives low.  Distinctive stems are matched at word starts to catch
    inflections (oxidation, electrolysis, trigonometry).  The check only rejects
    content that shows no signal for the chosen subject, so the AI is not asked
    to craft questions from completely unrelated material.
    """
    subject_slug = (subject_slug or "").strip().lower()
    if subject_slug not in _SUBJECT_KEYWORDS:
        return None
    text_lower = plain_text.lower()
    keywords = _SUBJECT_KEYWORDS[subject_slug]
    stems = _SUBJECT_STEMS.get(subject_slug, ())
    hits = sum(1 for kw in keywords if re.search(r"\b" + re.escape(kw) + r"\b", text_lower))
    hits += sum(1 for stem in stems if re.search(r"\b" + re.escape(stem), text_lower))
    label = _SUBJECT_LABELS.get(subject_slug, subject_slug)
    if hits == 0 and len(text_lower.split()) >= 10:
        return (
            f"The pasted content does not appear to be about {label}. "
            f"Select the correct subject or paste {label} lesson content before generating questions."
        )
    return None


# ---------- Question Generation ----------


_SUBJECT_LABELS = {
    "mathematics": "Mathematics",
    "chemistry": "Chemistry",
    "physics": "Physics",
}
_FORM_ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI"}


async def generate_quiz_questions(
    lesson_html: str,
    count: int = 5,
    subject_slug: str | None = None,
    form_level: int | None = None,
) -> tuple[list[dict], str, list]:
    """Generate NECTA-style quiz questions from lesson HTML.

    Strips HTML tags before sending to the AI service so the model
    sees plain educational text, not markup/CSS code.  When subject_slug
    and/or form_level are provided the prompt is scoped so the AI
    generates questions strictly within that subject and level.
    """
    plain_text = _strip_html(lesson_html)
    topic = _extract_topic_from_text(plain_text)

    # Build a subject/level scope instruction for the AI
    scope_parts: list[str] = []
    if subject_slug:
        scope_parts.append(
            f"the subject {_SUBJECT_LABELS.get(subject_slug, subject_slug)}"
        )
    if form_level:
        scope_parts.append(
            f"Form {_FORM_ROMAN.get(form_level, str(form_level))} level"
        )

    scope_instruction = ""
    if scope_parts:
        scope_instruction = (
            f"  IMPORTANT: Generate questions ONLY for {', '.join(scope_parts)}. "
            "If the content is not relevant to this subject/level, generate questions "
            "that test comprehension of the provided text while staying within the "
            "scope of that subject curriculum. "
        )

    payload: dict = {
        "content": plain_text,
        "count": count,
        "topic": topic,
    }
    if subject_slug:
        payload["subject_slug"] = subject_slug
    if form_level:
        payload["form_level"] = form_level
    if scope_instruction:
        payload["instructions"] = scope_instruction
    if subject_slug and form_level:
        try:
            from backend.services.syllabus_service import get_curriculum_context

            curriculum_ctx = get_curriculum_context(subject_slug, form_level)
            if curriculum_ctx:
                payload["curriculum_context"] = curriculum_ctx
        except Exception as exc:
            logger.debug("Could not fetch syllabus context for questions: %s", exc)

    try:
        result = await _call_ai_service("/api/questions/generate", payload)
        questions = result.get("questions") if result else None
        if questions:
            return questions, "casuya-ai", result.get("kbHits") or []
    except AiServiceError as exc:
        logger.warning("AI question generation failed: %s", exc)

    return _generate_questions_locally(plain_text, count, subject_slug, form_level), "offline", []


def _generate_questions_locally(
    lesson_html: str,
    count: int = 5,
    subject_slug: str | None = None,
    form_level: int | None = None,
) -> list[dict]:
    """Offline fallback: build multiple-choice questions from sentence text.

    Emits the SAME canonical schema as the AI path so the shared renderer
    (renderQuizQuestions) works whether or not the casuya-ai service is
    reachable — critical for the platform's offline-first / 2G target.

    When subject_slug/form_level are provided the concept is injected into
    the explanation text so the fallback output carries the scope metadata.
    """
    text = re.sub(r"<[^>]+>", " ", lesson_html)
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if len(s.strip()) > 20]
    if not sentences:
        subject = (subject_slug or "").strip().lower()
        sentences = ["Explain the main concept of this lesson for this subject."]
        if subject:
            sentences = [
                f"Define the key concept mentioned in this {subject} lesson.",
                f"State the formula used in this {subject} lesson.",
            ]

    scope = " for this subject and form level" if subject_slug or form_level else ""
    questions = []
    for sentence in sentences[:count]:
        words = sentence.split()
        if len(words) < 4:
            continue
        blank_idx = len(words) // 2
        answer = words[blank_idx]
        words[blank_idx] = "______"
        prompt = " ".join(words)
        distractors = [
            answer.upper(),
            answer.lower(),
            answer[::-1],
        ]
        # De-duplicate distractors against the answer and each other.
        seen = {answer.lower()}
        opts = [answer]
        for d in distractors:
            if d.lower() not in seen:
                seen.add(d.lower())
                opts.append(d)
        # Pad to exactly 4 unique-ish options if the sentence was too short.
        filler = 1
        while len(opts) < 4:
            candidate = f"option {filler}"
            if candidate not in seen:
                opts.append(candidate)
            filler += 1
        questions.append(
            {
                "text": prompt,
                "options": opts,
                "correctAnswer": "A",
                "explanation": f"The missing word is “{answer}”{scope}.",
            }
        )
    return questions


# ---------- AI Tutoring ----------


async def get_tutoring_response(
    question: str,
    lesson_context: str = "",
    subject_slug: str | None = None,
    form_level: int | None = None,
    max_questions: int | None = None,
) -> str:
    """Get an AI tutoring response for a student question.

    When subject_slug and form_level are provided, the TIE syllabus
    curriculum context is fetched and injected into the AI prompt
    so the response aligns with the exact NECTA syllabus. The AI service
    also grounds its answer on the knowledge base (RAG) scoped to the
    user's subject and class/form, and may append practice questions.
    """
    payload: dict = {
        "question": question,
        "context": lesson_context,
    }

    # Always pass subject when known so the AI service can trigger KB RAG retrieval.
    if subject_slug:
        payload["subject_slug"] = subject_slug
    if form_level:
        payload["form_level"] = form_level
    if max_questions:
        payload["max_questions"] = max_questions

    # Inject NECTA/TIE curriculum context if subject info is available
    if subject_slug and form_level:
        try:
            from backend.services.syllabus_service import get_curriculum_context

            curriculum_ctx = get_curriculum_context(subject_slug, form_level)
            if curriculum_ctx:
                payload["curriculum_context"] = curriculum_ctx
        except Exception as exc:
            from .client import logger

            logger.debug("Could not fetch syllabus context: %s", exc)

    payload_result = await get_tutoring_payload(
        question,
        lesson_context,
        subject_slug=subject_slug,
        form_level=form_level,
        max_questions=max_questions,
    )
    return payload_result["response"]


_FORMAT_RANK = {"none": 0, "partial": 1, "complete": 2}
_NECTA_FORMAT_RETRY_HINT = (
    "\n\n[IMPORTANT: Your answer MUST include all mandatory NECTA tutor sections — "
    "a 🌍 Context blockquote, structured step-by-step explanation, *** NECTA Examination Tip ***, "
    "and a Review Question line.]"
)


def _post_process_tutoring_response(text: str) -> str:
    """Mirror packages/ai post-process fixes for platform-side responses."""
    result = text or ""
    result = re.sub(
        r"^((?:🌍|> ?🌍|\*\*🌍|🌍 )\s*.*?Context.*)$",
        lambda m: "> " + re.sub(r"^>\s*", "", re.sub(r"^\*\*", "", m.group(1))),
        result,
        flags=re.MULTILINE,
    )
    lines = result.split("\n")
    out: list[str] = []
    for idx, line in enumerate(lines):
        if re.match(r"^(?:💡|> ?💡|\*\*💡)\s*\*?\*?NECTA Examination Tip", line):
            prev = "\n".join(out[-2:]) if out else ""
            if "---" not in prev and "***" not in prev:
                out.extend(["---", ""])
        out.append(line)
    result = "\n".join(out)
    result = result.replace("(1n)", "(n)")
    result = re.sub(r"\[next sub-topic\]", "a related topic", result, flags=re.IGNORECASE)
    return result.strip()


def _score_necta_format(text: str) -> str:
    has_context = bool(re.search(r"🌍|Context|Muktadha", text, re.I))
    has_necta = bool(re.search(r"NECTA|Exam(?:ination)? Tip|Kidokezo", text, re.I))
    has_structure = bool(re.search(r"^#{1,3}\s|^\*\*|^>\s", text, re.M))
    has_review = bool(re.search(r"Review Question|Swali la Mazoezi", text, re.I))
    score = sum([has_context, has_necta, has_structure, has_review])
    if score >= 3:
        return "complete"
    if score >= 2:
        return "partial"
    return "none"


def _clean_tutor_response(raw: str) -> str:
    response = re.sub(r" thinking[\s\S]*?<\/think>", "", raw or "").strip()
    if " thinking" in response:
        response = response.split(" thinking")[-1].strip()
    return _post_process_tutoring_response(response)


def _tutoring_result_from_ai(result: dict | None) -> dict | None:
    if not result or not result.get("response"):
        return None
    response = _clean_tutor_response(result["response"])
    format_level = result.get("formatLevel") or _score_necta_format(response)
    return {
        "response": response,
        "questions": result.get("questions") or [],
        "sourced": bool(result.get("sourced")),
        "kbHits": result.get("kbHits") or [],
        "source": "casuya-ai",
        "formatComplete": bool(result.get("formatComplete")) or format_level == "complete",
        "formatLevel": format_level,
    }


def _append_thread_context(lesson_context: str, messages: list[dict] | None) -> str:
    if not messages:
        return lesson_context
    turns: list[str] = []
    for msg in messages[-8:]:
        role = str(msg.get("role") or "").strip().lower()
        text = str(msg.get("text") or "").strip()
        if not text:
            continue
        label = "Student" if role == "user" else "Tutor"
        turns.append(f"{label}: {text[:600]}")
    if not turns:
        return lesson_context
    block = "CONVERSATION HISTORY:\n" + "\n".join(turns)
    merged = f"{lesson_context}\n\n{block}".strip() if lesson_context else block
    if len(merged) > 4000:
        return merged[:4000] + "…"
    return merged


def _prepare_tutoring_request(
    question: str,
    lesson_context: str = "",
    subject_slug: str | None = None,
    form_level: int | None = None,
    max_questions: int | None = None,
    lesson_id: str | None = None,
    messages: list[dict] | None = None,
    language: str | None = None,
) -> tuple[dict, str, dict | None]:
    """Build AI service payload, cache key, and optional cached row."""
    lesson_context = _append_thread_context(lesson_context, messages)
    if len(lesson_context) > 4000:
        lesson_context = lesson_context[:4000] + "…"
    payload: dict = {
        "question": question,
        "context": lesson_context,
    }
    if lesson_id:
        payload["lesson_id"] = lesson_id
    if subject_slug:
        payload["subject_slug"] = subject_slug
    if form_level:
        payload["form_level"] = form_level
    if max_questions:
        payload["max_questions"] = max_questions
    if language:
        payload["language"] = language

    from .tutor_cache import get_cached_tutor, tutor_cache_key

    cache_key = tutor_cache_key(
        question=question,
        lesson_context=lesson_context,
        lesson_id=lesson_id,
        subject_slug=subject_slug,
        form_level=form_level,
    )
    cached = get_cached_tutor(cache_key)
    if cached and cached.get("response"):
        cached = dict(cached)
        cached["source"] = "cached"
        return payload, cache_key, cached

    if subject_slug and form_level:
        try:
            from backend.services.syllabus_service import get_curriculum_context
            curriculum_ctx = get_curriculum_context(subject_slug, form_level)
            if curriculum_ctx:
                payload["curriculum_context"] = curriculum_ctx
        except Exception as exc:
            logger.debug("Could not fetch syllabus context: %s", exc)

    return payload, cache_key, None


async def iter_tutoring_stream_events(
    question: str,
    lesson_context: str = "",
    subject_slug: str | None = None,
    form_level: int | None = None,
    lesson_id: str | None = None,
    messages: list[dict] | None = None,
    language: str | None = None,
):
    """Yield SSE event strings for tutoring (real token stream or cache replay)."""
    import json
    import re

    from .client import AiServiceError, _stream_ai_service
    from .tutor_cache import set_cached_tutor

    payload, cache_key, cached = _prepare_tutoring_request(
        question,
        lesson_context,
        subject_slug=subject_slug,
        form_level=form_level,
        lesson_id=lesson_id,
        messages=messages,
        language=language,
    )

    if cached:
        response = cached.get("response") or ""
        chunks = re.split(r"(?<=[.!?])\s+|\n{2,}", response)
        for chunk in chunks:
            chunk = chunk.strip()
            if not chunk:
                continue
            yield f"data: {json.dumps({'chunk': chunk + ' ', 'done': False})}\n\n"
        yield f"data: {json.dumps({'chunk': '', 'done': True, 'source': cached.get('source', 'cached'), 'kbHits': cached.get('kbHits') or [], 'formatComplete': cached.get('formatComplete', False), 'formatLevel': cached.get('formatLevel', 'none')})}\n\n"
        return

    accumulated = ""
    final_meta: dict = {}
    try:
        async for event in _stream_ai_service("/api/tutoring/stream", payload):
            yield event
            line = event.strip()
            if not line.startswith("data: "):
                continue
            try:
                data = json.loads(line[6:])
            except json.JSONDecodeError:
                continue
            if data.get("chunk"):
                accumulated += data["chunk"]
            if data.get("done"):
                final_meta = data
    except AiServiceError as exc:
        logger.warning("AI tutoring stream failed: %s", exc)
        offline = (
            "I'm sorry, the AI tutor is currently unavailable. "
            "Please try again later or ask your teacher for help."
        )
        yield f"data: {json.dumps({'chunk': offline, 'done': True, 'source': 'offline', 'kbHits': [], 'formatComplete': False, 'formatLevel': 'none'})}\n\n"
        return

    if accumulated.strip() and final_meta.get("source") == "casuya-ai":
        parsed = {
            "response": accumulated.strip(),
            "kbHits": final_meta.get("kbHits") or [],
            "formatComplete": final_meta.get("formatComplete", False),
            "formatLevel": final_meta.get("formatLevel", "none"),
            "source": "casuya-ai",
        }
        set_cached_tutor(cache_key, parsed)


async def get_tutoring_payload(
    question: str,
    lesson_context: str = "",
    subject_slug: str | None = None,
    form_level: int | None = None,
    max_questions: int | None = None,
    lesson_id: str | None = None,
    messages: list[dict] | None = None,
    language: str | None = None,
) -> dict:
    """Like get_tutoring_response but returns the full AI payload, including any
    practice questions the AI service generated (up to 20 of any type)."""
    from .tutor_cache import set_cached_tutor

    payload, cache_key, cached = _prepare_tutoring_request(
        question,
        lesson_context,
        subject_slug=subject_slug,
        form_level=form_level,
        max_questions=max_questions,
        lesson_id=lesson_id,
        messages=messages,
        language=language,
    )
    if cached:
        return cached

    offline_msg = (
        "I'm sorry, the AI tutor is currently unavailable. "
        "Please try again later or ask your teacher for help."
    )
    try:
        result = await _call_ai_service("/api/tutoring/explain", payload)
        parsed = _tutoring_result_from_ai(result)
        if parsed:
            format_level = parsed.get("formatLevel", "none")
            if format_level != "complete":
                retry_payload = {
                    **payload,
                    "question": str(question or "") + _NECTA_FORMAT_RETRY_HINT,
                }
                retry_result = await _call_ai_service("/api/tutoring/explain", retry_payload)
                retry_parsed = _tutoring_result_from_ai(retry_result)
                if retry_parsed:
                    retry_level = retry_parsed.get("formatLevel", "none")
                    if _FORMAT_RANK.get(retry_level, 0) > _FORMAT_RANK.get(format_level, 0):
                        parsed = retry_parsed
            logger.info(
                "Tutor response format=%s complete=%s lesson_id=%s subject=%s",
                parsed.get("formatLevel"),
                parsed.get("formatComplete"),
                lesson_id or "",
                subject_slug or "",
            )
            set_cached_tutor(cache_key, {**parsed, "source": "casuya-ai"})
            return parsed
    except AiServiceError as exc:
        logger.warning("AI tutoring failed: %s", exc)

    return {
        "response": offline_msg,
        "questions": [],
        "sourced": False,
        "kbHits": [],
        "source": "offline",
        "formatComplete": False,
        "formatLevel": "none",
    }


async def generate_practice_questions(
    question: str = "",
    lesson_context: str = "",
    subject_slug: str | None = None,
    form_level: int | None = None,
    count: int = 10,
) -> tuple[list[dict], str]:
    """Generate up to 20 practice questions of any type for the given topic.

    Delegates to the casuya-ai /api/tutoring/quiz endpoint, which scopes the
    questions to the user's subject and class/form and grounds them in the
    NECTA/TIE knowledge base.
    """
    payload: dict = {
        "question": question,
        "context": lesson_context,
        "count": count,
    }
    if subject_slug:
        payload["subject_slug"] = subject_slug
    if form_level:
        payload["form_level"] = form_level

    try:
        result = await _call_ai_service("/api/tutoring/quiz", payload)
        questions = result.get("questions") if result else None
        if questions:
            return questions, "casuya-ai"
    except AiServiceError as exc:
        logger.warning("AI practice quiz failed: %s", exc)
    return [], "offline"


# ---------- Content Analysis ----------


async def analyze_content(html_content: str) -> dict:
    """Analyze educational content for quality, readability, and completeness."""
    try:
        result = await _call_ai_service(
            "/api/content/analyze",
            {"content": html_content},
        )
        if result:
            result["source"] = "casuya-ai"
            return result
    except AiServiceError as exc:
        logger.warning("AI content analyze failed: %s", exc)

    text = re.sub(r"<[^>]+>", " ", html_content)
    words = text.split()
    sentences = re.split(r"[.!?]+", text)
    return {
        "word_count": len(words),
        "sentence_count": len([s for s in sentences if s.strip()]),
        "avg_sentence_length": len(words) / max(len(sentences), 1),
        "has_images": "<img" in html_content.lower(),
        "has_videos": "<video" in html_content.lower() or "youtube" in html_content.lower(),
        "has_quizzes": "quiz" in html_content.lower() or "question" in html_content.lower(),
        "source": "offline",
    }
