"""Exam paper generation for teacher assignments (NECTA / internal-exam format).

Builds validated, NECTA-style exam papers as JSON (stored in the
``assignments.paper_json`` column). Question *content* is composed by the
casuya-ai service (see ``ai_service.generate_exam_paper``); this module is
responsible for the structure that makes a paper reliable and valid:

* canonical section layout per exam kind (NECTA-style / internal / exercise),
* official-sounding section instructions with marks/counts spelled out,
* ``validate_paper`` — numbering, marks totals, section completeness,
* ``repair_paper`` — drops empty questions and recomputes everything,
* ``generate_exam_paper_local`` — a deterministic, offline fallback that
  builds a complete paper from the lesson text (2G/3G safe).

Offline-first rule: a teacher can always obtain a valid paper even when the
AI service is unreachable.
"""

from __future__ import annotations

import json
import random
import re
from copy import deepcopy
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.lesson import Lesson, Subject, Subtopic, Topic

KIND_LABELS = {
    "necta": "NECTA-STYLE EXAMINATION",
    "internal": "INTERNAL EXAMINATION",
    "exercise": "CLASS EXERCISE",
}

KIND_DURATION = {
    "necta": "2 Hours",
    "internal": "1 Hour 30 Minutes",
    "exercise": "40 Minutes",
}

SECTIONS_BY_KIND = {
    "necta": [
        {"id": "A", "title": "MULTIPLE CHOICE", "question_type": "mcq", "count": 20, "marks_per_question": 1},
        {"id": "B", "title": "SHORT ANSWER / STRUCTURED", "question_type": "structured", "count": 6, "marks_per_question": 6},
        {"id": "C", "title": "ESSAY / PROBLEM SOLVING", "question_type": "essay", "count": 2, "marks_per_question": 22},
    ],
    "internal": [
        {"id": "A", "title": "OBJECTIVE QUESTIONS", "question_type": "mcq", "count": 10, "marks_per_question": 1},
        {"id": "B", "title": "SHORT ANSWER QUESTIONS", "question_type": "structured", "count": 5, "marks_per_question": 4},
        {"id": "C", "title": "ESSAY QUESTION", "question_type": "essay", "count": 1, "marks_per_question": 10},
    ],
    "exercise": [
        {"id": "A", "title": "MULTIPLE CHOICE", "question_type": "mcq", "count": 5, "marks_per_question": 1},
        {"id": "B", "title": "SHORT ANSWER", "question_type": "structured", "count": 3, "marks_per_question": 2},
        {"id": "C", "title": "WRITTEN RESPONSE", "question_type": "essay", "count": 1, "marks_per_question": 4},
    ],
}

_ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI"}
_ROMAN_INT = {v: k for k, v in _ROMAN.items()}

_ONES = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
]
_TENS = ["", "", "twenty", "thirty", "forty", "fifty"]


# ---------- form / label helpers ----------


def _form_level_int(form_level: str | int | None) -> int:
    if isinstance(form_level, bool):
        return 1
    if isinstance(form_level, int):
        return max(1, min(6, form_level))
    if not form_level:
        return 1
    s = str(form_level).strip()
    if s.isdigit():
        return max(1, min(6, int(s)))
    m = re.match(r"(?i)^form\s*(III|II|IV|VI|V|I)\b", s)
    if m:
        return _ROMAN_INT.get(m.group(1).upper(), 1)
    key = s.upper()
    return _ROMAN_INT.get(key, _ROMAN_INT.get(key.rstrip("."), 1))


def _format_form(form_level: int) -> str:
    return f"Form {_ROMAN.get(max(1, min(6, form_level)), 'I')}"


def _num_words(n: int) -> str:
    if n < 20:
        return _ONES[n] or str(n)
    t = n // 10
    if t >= 6:
        return str(n)
    return f"{_TENS[t]}-{_ONES[n % 10]}" if n % 10 else _TENS[t]


def _count_label(count: int) -> str:
    return f"{_num_words(count)} ({count}) questions"


def _mark_label(n: int) -> str:
    return f"{_num_words(n)} ({n}) mark{'s' if n != 1 else ''}"


def section_instruction(sec: dict) -> str:
    """Official-sounding instruction line mirroring how NECTA papers phrase it."""
    if sec.get("question_type") == "mcq":
        return (
            f"This section consists of {_count_label(sec['count'])}. "
            "Every question carries one (1) mark. Answer ALL questions."
        )
    return (
        f"This section consists of {_count_label(sec['count'])}. "
        f"Each question carries {_mark_label(sec['marks_per_question'])}. Answer ALL questions."
    )


def build_spec(
    kind: str,
    overrides: list[dict] | None = None,
    duration: str | None = None,
) -> tuple[str, str, list[dict]]:
    """Merge the preset section layout for ``kind`` with teacher overrides."""
    kind = kind if kind in SECTIONS_BY_KIND else "internal"
    base = deepcopy(SECTIONS_BY_KIND[kind])
    if overrides:
        by_id = {str(o.get("id")).upper(): o for o in overrides if isinstance(o, dict) and o.get("id")}
        for s in base:
            o = by_id.get(str(s["id"]).upper())
            if not o:
                continue
            try:
                s["count"] = max(1, min(40, int(o.get("count") or s["count"])))
            except (TypeError, ValueError):
                pass
            try:
                s["marks_per_question"] = max(1, min(50, int(o.get("marks_per_question") or s["marks_per_question"])))
            except (TypeError, ValueError):
                pass
    dur = (duration or "").strip() or KIND_DURATION.get(kind, "2 Hours")
    return kind, dur, base


def presets(form_level: int | None = None) -> dict:
    """Canonical section layouts for the teacher UI (exam-presets endpoint)."""
    out: dict = {}
    form = _form_level_int(form_level)
    mode = "A-Level (ACSEE)" if form >= 5 else "O-Level (CSEE/FTNA)"
    for kind in ("necta", "internal", "exercise"):
        sections = deepcopy(SECTIONS_BY_KIND[kind])
        for s in sections:
            s["instruction"] = section_instruction(s)
        out[kind] = {
            "label": KIND_LABELS[kind],
            "duration": KIND_DURATION[kind],
            "mode": mode,
            "total_marks": sum(s["count"] * s["marks_per_question"] for s in sections),
            "sections": sections,
        }
    return out


# ---------- lesson context ----------


def resolve_lesson_context(lesson_id: str) -> dict | None:
    """Resolve a lesson to subject slug/name, form level and topic titles."""
    _gen = get_db()
    db: Session = next(_gen)
    try:
        row = (
            db.query(Lesson, Subtopic, Topic, Subject)
            .join(Subtopic, Lesson.subtopic_id == Subtopic.id)
            .join(Topic, Subtopic.topic_id == Topic.id)
            .join(Subject, Topic.subject_id == Subject.id)
            .filter(Lesson.id == lesson_id)
            .first()
        )
        if not row:
            return None
        lesson, subtopic, topic, subject = row
        return {
            "lesson_id": str(lesson.id),
            "lesson_title": lesson.title,
            "lesson_content": lesson.content or lesson.package_html or "",
            "subtopic_title": subtopic.title,
            "topic_title": topic.title,
            "subject_slug": subject.slug,
            "subject_name": subject.name,
            "form_level": _form_level_int(topic.form_level),
        }
    finally:
        _gen.close()


# ---------- validation / repair ----------


def validate_paper(paper: dict) -> tuple[bool, list[str]]:
    """Structural validation — numbering, marks totals, section completeness."""
    issues: list[str] = []
    sections = paper.get("sections") if isinstance(paper, dict) else None
    if not isinstance(sections, list) or not sections:
        return False, ["paper has no sections"]

    expected = 1
    total = 0
    for sec in sections:
        qs = sec.get("questions")
        if not isinstance(qs, list) or not qs:
            issues.append(f"Section {sec.get('id')} has no questions")
            continue
        if sec.get("question_type") == "mcq":
            for q in qs:
                opts = q.get("options")
                if not isinstance(opts, list) or len(opts) < 2:
                    issues.append(f"Section {sec.get('id')} Q{q.get('number')} missing options")
                try:
                    if int(q.get("answer")) not in range(4):
                        issues.append(f"Section {sec.get('id')} Q{q.get('number')} invalid answer")
                except (TypeError, ValueError):
                    issues.append(f"Section {sec.get('id')} Q{q.get('number')} invalid answer")
        for q in qs:
            if not str(q.get("text") or "").strip():
                issues.append(f"Section {sec.get('id')} Q{q.get('number')} empty text")
            if int(q.get("number") or 0) != expected:
                issues.append(f"expected Q{expected}, found Q{q.get('number')}")
            expected += 1
            try:
                total += int(q.get("marks") or 0)
            except (TypeError, ValueError):
                issues.append(f"Section {sec.get('id')} Q{q.get('number')} invalid marks")

    header_total = (paper.get("header") or {}).get("total_marks")
    try:
        if total != int(header_total or 0):
            issues.append(f"marks total {total} != header total {header_total}")
    except (TypeError, ValueError):
        issues.append(f"invalid header total_marks {header_total!r}")

    return (not issues), issues


def repair_paper(paper: dict) -> dict:
    """Normalize a paper: drop empty questions, renumber, recompute totals."""
    repaired = json.loads(json.dumps(paper))
    header = repaired.get("header") or {}
    sections: list[dict] = []
    n = 1
    for sec in repaired.get("sections") or []:
        qs = [q for q in (sec.get("questions") or []) if isinstance(q, dict) and str(q.get("text") or "").strip()]
        out_qs: list[dict] = []
        for q in qs:
            try:
                marks = max(1, int(q.get("marks") or sec.get("marks_per_question") or 1))
            except (TypeError, ValueError):
                marks = max(1, int(sec.get("marks_per_question") or 1))
            entry = {
                "number": n,
                "text": re.sub(r"\s+", " ", str(q["text"])).strip(),
                "marks": marks,
            }
            if sec.get("question_type") == "mcq":
                raw_opts = [str(o).strip() for o in (q.get("options") or []) if str(o).strip()]
                while len(raw_opts) < 4:
                    raw_opts.append(f"{chr(65 + len(raw_opts))}. —")
                raw_opts = raw_opts[:4]
                labeled = [
                    o if re.match(r"^[A-Da-d][.)]", o) else f"{chr(65 + i)}. {o}"
                    for i, o in enumerate(raw_opts)
                ]
                answer = q.get("answer")
                if isinstance(answer, int) and not isinstance(answer, bool):
                    idx = answer
                elif isinstance(answer, str) and re.match(r"^[A-Da-d]$", answer.strip()):
                    idx = ord(answer.strip().upper()) - 65
                else:
                    idx = 0
                entry["options"] = labeled
                entry["answer"] = max(0, min(3, idx))
            n += 1
            out_qs.append(entry)
        sec2 = dict(sec)
        sec2["questions"] = out_qs
        sec2["count"] = len(out_qs)
        sec2["marks_per_question"] = max(1, int(sec.get("marks_per_question") or 1))
        sec2["instruction"] = section_instruction(sec2)
        sections.append(sec2)

    total = sum(int(q["marks"]) for s in sections for q in s["questions"])
    header["total_marks"] = total
    repaired["header"] = header
    repaired["sections"] = sections
    repaired["meta"] = repaired.get("meta") or {}
    return repaired


def paper_summary(paper: dict | None) -> dict | None:
    """Light-weight descriptor of a paper (safe to ship in list endpoints)."""
    if not isinstance(paper, dict):
        return None
    header = paper.get("header") or {}
    sections = paper.get("sections") or []
    return {
        "kind": paper.get("kind"),
        "format_label": paper.get("format_label"),
        "subject": header.get("subject"),
        "subject_slug": header.get("subject_slug"),
        "form_label": header.get("form_label"),
        "form_level": header.get("form_level"),
        "topic": header.get("topic"),
        "duration": header.get("duration"),
        "total_marks": header.get("total_marks"),
        "sections": [
            {
                "id": s.get("id"),
                "title": s.get("title"),
                "question_type": s.get("question_type"),
                "count": s.get("count"),
                "marks_per_question": s.get("marks_per_question"),
            }
            for s in sections
            if isinstance(s, dict)
        ],
    }


# ---------- local (offline) question generation ----------


def _strip_html(html: str) -> str:
    text = re.sub(r"<!DOCTYPE[^>]*>", " ", html, flags=re.IGNORECASE)
    text = re.sub(r"<head[\s\S]*?</head>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<nav[\s\S]*?</nav>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<header[\s\S]*?</header>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<footer[\s\S]*?</footer>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


_NOISE_PATTERNS = re.compile(
    r"(?i)\b(animated|loading|math\s*renderer|renderer|chalkboard|simulation|"
    r"dynamic\s+classroom|interactive|step-by-step|step\s+\d|/\s*\d+|"
    r"canvas|pen\s+tool|tool|click|tap|swipe|drag|scroll|"
    r"mathjax|katex|latex|tex|font\s+family|import\s+url|"
    r"rgba?\(|rgb\(|color|background|border|padding|margin|"
    r"display|flex|grid|width|height|position|overflow|"
    r"animation|transition|transform|opacity|z-index|"
    r"function|var\s|const\s|let\s|return|typeof|undefined|null|"
    r"window\.|document\.|console\.|addEventListener|querySelector|"
    r"module|exports|require|import\s|export\s|"
    r"form\s+[IVX]+\s*-\s*Mathematics|form\s+[IVX]+|"
    r"©|®|™|all\s+rights\s+reserved)\b"
)


_STOPWORDS = {
    "which", "their", "there", "about", "would", "could", "should", "because",
    "between", "through", "during", "before", "after", "above", "below",
    "other", "another", "these", "those", "first", "second", "third", "every",
    "often", "always", "never", "sometimes", "being", "having", "doing",
    "makes", "making", "called", "known", "means", "include", "includes",
    "included", "important", "different", "following", "water", "things",
    "lesson", "animated", "loading", "dynamic", "classroom", "simulation",
    "interactive", "step", "steps", "given", "proposition", "real",
    "values", "satisfy", "standard", "form", "identify", "coefficients",
    "state", "map", "find", "write", "show", "answer", "using",
    "describe", "explain", "discuss", "define", "list", "give",
    "note", "example", "examples", "two", "three", "four", "five",
    "quadratic", "equation", "formula", "coefficient", "coefficients",
    "polynomial", "discriminant", "radical", "simplification",
    "substitution", "derivation", "solution", "solutions", "equations",
    "method", "square", "completing", "standard", "comparison",
    "structural", "framework", "generic", "argument", "perfect",
    "canonical", "partition", "space", "branch", "evaluate",
    "evaluate", "evaluated", "reintroduce", "isolate", "mapped",
    "substitute", "given", "second-degree", "real", "values",
    "spinner", "subtitle", "expression", "board", "content",
    "counter", "canvas", "pen", "tool", "click", "tap",
    "swipe", "drag", "scroll", "color", "background", "border",
    "animation", "transition", "transform", "opacity", "font",
    "family", "display", "flex", "grid", "width", "height",
    "position", "overflow", "margin", "padding", "style",
    "script", "function", "return", "var", "const", "let",
    "window", "document", "console", "module", "export",
    "import", "require", "type", "class", "id", "name",
    "charset", "viewport", "content", "http", "https", "www",
    "com", "org", "net", "html", "css", "javascript",
}


def _extract_terms(html: str, text: str, max_terms: int = 24) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()

    def add(raw: str) -> None:
        cleaned = re.sub(r"\s+", " ", raw).strip().strip(".,;:\"'""''")
        if len(cleaned) < 4 or len(cleaned) > 50:
            return
        if re.search(r"[\\${}=<>]", cleaned):
            return
        if re.search(r"^[a-z]+-[a-z]+$", cleaned.lower()):
            return
        key = cleaned.lower()
        if key in seen or _NOISE_PATTERNS.search(cleaned):
            return
        words = key.split()
        if all(w in _STOPWORDS for w in words):
            return
        seen.add(key)
        terms.append(cleaned)

    for pat in (r"<h[2-4][^>]*>(.*?)</h[2-4]>",):
        for m in re.finditer(pat, html, re.IGNORECASE | re.DOTALL):
            inner = re.sub(r"<[^>]+>", "", m.group(1)).strip()
            if inner and not _NOISE_PATTERNS.search(inner) and not re.search(r"[\\${}=<>]", inner):
                add(inner)
    for pat in (r"<strong[^>]*>(.*?)</strong>", r"<b[^>]*>(.*?)</b>"):
        for m in re.finditer(pat, html, re.IGNORECASE | re.DOTALL):
            inner = re.sub(r"<[^>]+>", "", m.group(1)).strip()
            if inner and not _NOISE_PATTERNS.search(inner) and not re.search(r"[\\${}=<>]", inner):
                add(inner)
    for m in re.finditer(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)", text):
        candidate = m.group(1)
        if not _NOISE_PATTERNS.search(candidate) and not re.search(r"[\\${}=<>]", candidate):
            add(candidate)
    for m in re.finditer(r'"([^"]{4,50})"', html):
        val = m.group(1)
        if (
            not _NOISE_PATTERNS.search(val)
            and not re.search(r"[\\${}=<>]", val)
            and not re.search(r"^[a-z]+-[a-z]+$", val.lower())
            and " " in val
        ):
            add(val)
    if not terms:
        for word in re.findall(r"\b[A-Za-z]{6,}\b", text):
            if word.lower() not in _STOPWORDS and not _NOISE_PATTERNS.search(word):
                add(word)
    return terms[:max_terms]


def _content_lines(html: str) -> list[str]:
    """Extract meaningful content lines from HTML, stripping tags and filtering noise."""
    text = re.sub(r"<!DOCTYPE[^>]*>", " ", html, flags=re.IGNORECASE)
    text = re.sub(r"<head[\s\S]*?</head>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<nav[\s\S]*?</nav>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<header[\s\S]*?</header>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<footer[\s\S]*?</footer>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    lines = []
    for line in text.split("\n"):
        cleaned = re.sub(r"\s+", " ", line).strip()
        if len(cleaned) >= 50 and not _NOISE_PATTERNS.search(cleaned) and not re.search(r"[\\${}]", cleaned):
            lines.append(cleaned)
    return lines


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\u201c\"'])", text)
    out: list[str] = []
    for p in parts:
        cleaned = re.sub(r"\s+", " ", p).strip()
        if 30 <= len(cleaned) <= 300 and not _NOISE_PATTERNS.search(cleaned):
            out.append(cleaned)
    return out


def _pick_salient_word(sentence: str) -> tuple[str, int] | None:
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9\-']*", sentence)
    best_w, best_i = "", -1
    for i, w in enumerate(tokens):
        base = re.sub(r"[^a-zA-Z]", "", w).lower()
        if base in _STOPWORDS or len(base) < 6:
            continue
        if len(w) > len(best_w):
            best_w, best_i = w, i
    if best_i < 0:
        return None
    return best_w, best_i


def _mcq_variants(sentence: str, salient: str, terms: list[str], rng: random.Random) -> list[str]:
    variants: list[str] = []
    start = rng.randrange(max(1, len(terms)))
    for k in range(len(terms)):
        t = terms[(start + k) % len(terms)]
        if t == salient:
            continue
        variants.append(sentence.replace(salient, t, 1) if t not in sentence else sentence.replace(t, "not " + t, 1))
        if len(variants) >= 3:
            break
    i = 0
    while len(variants) < 3:
        i += 1
        if i % 2:
            variants.append(sentence.replace(salient, "not " + salient, 1))
        else:
            variants.append(sentence.replace(salient, salient + "s", 1))
    return variants[:3]


_MCQ_QUESTIONS = [
    "Which of the following is a {concept}?",
    "What is the correct definition of {concept}?",
    "Which statement about {concept} is TRUE?",
    "In the context of this lesson, {concept} refers to:",
    "Which of the following best describes {concept}?",
]


def _build_mcq(sentence: str, terms: list[str], rng: random.Random, qno: int = 0) -> dict | None:
    if not sentence or not terms:
        return None
    if re.search(r"[\\${}]", sentence) or len(sentence) < 50:
        return None
    if not re.search(r"[aeiou]{3,}", sentence.lower()):
        return None
    picked = _pick_salient_word(sentence)
    if picked is None:
        return None
    salient, _ = picked
    concept = salient.lower()
    phrasing = _MCQ_QUESTIONS[qno % len(_MCQ_QUESTIONS)].format(concept=concept)
    correct = sentence
    wrong_pool = [t for t in terms if t.lower() != concept and not re.search(r"[\\${}]", t) and " " not in t]
    rng.shuffle(wrong_pool)
    distractors: list[str] = []
    for t in wrong_pool[:3]:
        alt = sentence.replace(salient, t, 1) if t.lower() not in sentence.lower() else sentence.replace(salient, "not " + t, 1)
        if not re.search(r"[\\${}]", alt):
            distractors.append(alt)
    while len(distractors) < 3:
        idx = len(distractors)
        if idx % 2:
            distractors.append(sentence.replace(salient, "not " + salient, 1))
        else:
            distractors.append(sentence.replace(salient, salient + "s", 1))
    pool = [correct] + distractors[:3]
    order = list(range(len(pool)))
    rng.shuffle(order)
    options = [f"{chr(65 + i)}. {re.sub(r'\\s+', ' ', pool[order[i]]).strip()}" for i in range(len(order))]
    return {
        "text": phrasing,
        "options": options,
        "answer": order.index(0),
    }


_STRUCTURED_TEMPLATES = [
    "Define the term \u201c{term}\u201d as used in this lesson.",
    "Explain, in your own words, what is meant by \u201c{term}\u201d.",
    "State two characteristics or properties of {term} mentioned in the lesson.",
    "Give two examples of {term} from the lesson.",
    "Describe the importance of {term} in the study of {subject}.",
]


def _build_structured(term: str, ctx: dict, i: int, terms: list[str]) -> dict:
    subject = ctx.get("subject_name") or "the subject"
    template = _STRUCTURED_TEMPLATES[i % len(_STRUCTURED_TEMPLATES)]
    return {"text": template.format(term=term, subject=subject)}


ESSAY_TEMPLATES = [
    "Write a well-organized essay on \u201c{topic}\u201d, using specific examples and facts from the lesson.",
    "Describe how \u201c{topic}\u201d is covered in this lesson. Your answer must refer to the key concepts, their relationships, and at least two concrete examples from the lesson text.",
    "Discuss the importance of \u201c{topic}\u201d in the study of {subject}. Support your answer with information from the lesson.",
]


def _build_essay(ctx: dict, i: int) -> dict:
    topic = ctx.get("topic_title") or ctx.get("subtopic_title") or ctx.get("lesson_title") or "the topic"
    subject = ctx.get("subject_name") or "the subject"
    template = ESSAY_TEMPLATES[i % len(ESSAY_TEMPLATES)]
    return {"text": template.format(topic=topic, subject=subject)}


_TOPIC_MCQ = [
    ("What is the main subject of this lesson?", ["{subject}", "History", "Geography", "Literature"]),
    ("Which topic does this lesson focus on?", ["{topic}", "Economics", "Biology", "Physics"]),
    ("What type of content does this lesson cover?", ["{subject} concepts and principles", "Sports training", "Cooking recipes", "Music theory"]),
    ("In which academic area is this lesson categorised?", ["{subject}", "Physical Education", "Art and Design", "Computer Science"]),
    ("What is the primary learning objective of this lesson?", ["Understanding {topic}", " memorising dates", " learning recipes", " practising sports"]),
]


def _build_topic_mcq(ctx: dict, qno: int) -> dict:
    subject = ctx.get("subject_name") or "the subject"
    topic = ctx.get("topic_title") or ctx.get("subtopic_title") or "the topic"
    q_template, opts_template = _TOPIC_MCQ[qno % len(_TOPIC_MCQ)]
    question = q_template.format(subject=subject, topic=topic)
    correct = opts_template[0].format(subject=subject, topic=topic)
    distractors = [o.format(subject=subject, topic=topic) for o in opts_template[1:]]
    pool = [correct] + distractors
    order = list(range(len(pool)))
    random.shuffle(order)
    options = [f"{chr(65 + i)}. {pool[order[i]]}" for i in range(len(order))]
    return {
        "text": question,
        "options": options,
        "answer": order.index(0),
    }


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


def generate_exam_paper_local(ctx: dict, kind: str, spec: list[dict]) -> dict:
    """Build a complete, valid paper offline from the lesson content."""
    form_level = ctx.get("form_level") or 1
    sections: list[dict] = []
    for sec in spec:
        qs = generate_section_questions_local(sec, ctx, int(sec.get("count") or 1))
        sections.append(
            {
                "id": sec["id"],
                "title": sec["title"],
                "instruction": section_instruction(sec),
                "question_type": sec.get("question_type"),
                "count": len(qs),
                "marks_per_question": sec.get("marks_per_question"),
                "questions": qs,
            }
        )
    total = sum(int(q["marks"]) for s in sections for q in s["questions"])
    n = 1
    for s in sections:
        for q in s["questions"]:
            q["number"] = n
            n += 1
    kind_label = KIND_LABELS.get(kind, "EXAMINATION")
    header = {
        "exam": kind_label,
        "subject": ctx.get("subject_name", ""),
        "subject_slug": ctx.get("subject_slug", ""),
        "form_level": form_level,
        "form_label": f"{_format_form(form_level)} - {ctx.get('subject_name', '')}",
        "topic": ctx.get("topic_title") or ctx.get("subtopic_title") or "",
        "lesson_title": ctx.get("lesson_title", ""),
        "duration": KIND_DURATION.get(kind, "2 Hours"),
        "year": str(datetime.now(timezone.utc).year),
        "total_marks": total,
        "instructions": [
            f"This paper consists of {len(sections)} section(s) with a total of {total} marks.",
            "Answer ALL questions.",
            "Marks for each question are shown in brackets.",
            (
                "Write all your answers in the space provided below each question."
                if kind == "exercise"
                else "For objective questions choose the correct answer and write its letter. Show your working where necessary."
            ),
        ],
    }
    return {
        "kind": kind,
        "format_label": kind_label,
        "header": header,
        "sections": sections,
        "meta": {"generator": "local", "generated_at": datetime.now(timezone.utc).isoformat()},
    }


def ensure_paper_complete(paper: dict, spec: list[dict], ctx: dict) -> dict:
    """Pad an AI-generated paper up to the requested section sizes using local
    questions, so the teacher always previews a complete paper."""
    paper = repair_paper(paper)
    by_id = {str(s.get("id")).upper(): s for s in (paper.get("sections") or []) if isinstance(s, dict)}
    fixed: list[dict] = []
    for sec in spec:
        target = max(1, min(40, int(sec.get("count") or 1)))
        s = dict(by_id.get(str(sec.get("id")).upper()) or sec)
        qs = [q for q in (s.get("questions") or []) if isinstance(q, dict) and str(q.get("text") or "").strip()]
        have = len(qs)
        if have < target:
            qs.extend(
                generate_section_questions_local(sec, ctx, target - have)
            )
        s["questions"] = qs
        s["count"] = len(qs)
        s["marks_per_question"] = int(sec.get("marks_per_question") or min((int(q.get("marks") or 1) for q in qs), default=1))
        for q in qs:
            q["marks"] = s["marks_per_question"]
        s["instruction"] = section_instruction(sec)
        fixed.append(s)
    paper["sections"] = fixed
    header = dict(paper.get("header") or {})
    header["total_marks"] = sum(int(q["marks"]) for s in fixed for q in s["questions"])
    paper["header"] = header
    return repair_paper(paper)