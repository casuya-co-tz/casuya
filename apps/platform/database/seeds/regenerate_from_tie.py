"""Regenerate O-Level (Form 1-4) syllabus content from the authoritative TIE
knowledge-base JSON files parsed from the official TIE PDFs.

Strategy (hybrid):
- For subjects where the knowledge-base JSON is rich and complete (Physics,
  English, Kiswahili), rebuild the O-Level topics/subtopics/outcomes from the
  real TIE lesson content (unit -> competence -> lesson), preserving the
  official NECTA code and the per-form estimated-period totals already present
  in the current seed (the knowledge-base JSON carries no period data).
- A-Level (Form 5-6) topics are left untouched.
- Official NECTA codes are never taken from the knowledge-base (its codes are
  unreliable); they are preserved from the current seed.

Transformation:
  knowledge-base "unit"         -> seed "topic"   (broad competence theme)
  knowledge-base "topic"(comp.) -> seed "subtopic" (numbered competence)
  knowledge-base "lesson"       -> seed "outcome"  (specific learning objective)

The knowledge-base is messy (duplicated units, OCR noise, unreliable "form" and
"subject_code" metadata). This tool cleans/dedupes and maps forms explicitly.
"""

from __future__ import annotations

import json
import os
import re
from collections import OrderedDict
from pathlib import Path

# ---------------------------------------------------------------------------
# Enrichment maps (ENGLISH / KISWAHILI)
#
# The KB O-Level JSON for these two subjects collapsed all Forms 1-4 into a
# single pool of competency units (no per-form signal), so we keep the curated
# per-form "skeleton" topics (preserving form distribution + period totals) and
# inject every authentic KB competence lesson into the best-matching seed
# topic. Keys are the exact _clean()-ed competence (topic_name) from the KB;
# values are the exact seed topic title to enrich. A-Level is never touched.
# ---------------------------------------------------------------------------
ENGLISH_TOPIC_MAP = {
    "Read texts for comprehension": "Reading for Comprehension (Part I)",
    "Comprehend oral messages with increasing difficulty": "Listening and Speaking (Oral Communication)",
    "Respond appropriately in a variety of oral and written communication contexts": "Reading for Fluency and Critical Inference",
    "Construct meaning from a variety of texts": "Complex Reading and Summary Compilations",
    "Use ICT tools to search for information from different sources": "Reading for Fluency and Critical Inference",
    "Organise information obtained from different sources": "Complex Reading and Summary Compilations",
    ". Develop listening skills": "Listening and Speaking (Oral Communication)",
    "Develop listening skills": "Listening and Speaking (Oral Communication)",
    "Produce short and coherent oral messages with intelligible pronunciation and fluency": "Spoken English and Debate Mechanics",
    "Use appropriate grammar and vocabulary for oral communication in a variety of contexts": "Spoken English and Debate Mechanics",
    "Use appropriate grammar and vocabulary in oral and in written language tasks": "Grammar Patterns (Part I)",
    "Develop vocabulary from conversations and written texts": "Vocabulary Building and Expressions",
    "Create a variety of texts for different communicative purposes using the appropriate tone and register": "Writing Skills (Part I)",
    "Conduct a socio- cultural analysis of functional texts": "Professional and Academic Writing",
    "Apply principles of editing and proofreading in a variety of texts": "Translation and Interpretation Fundamentals",
    "Apply principles of interpretation to provide simple authentic interpretations": "Translation and Interpretation Fundamentals",
    "Apply principles of translation to produce simple authentic translation": "Translation and Interpretation Fundamentals",
    "Manage short translation and editing projects using Computer- Assisted Tools": "Translation and Interpretation Fundamentals",
    "Appreciate the aesthetics and value of literature": "Introduction to Literature",
    "Evaluate the context in which literary texts are written, read and understood": "Introduction to Literary Analysis",
    "Analyse genres of literature and appreciate their conventions": "Literary Critique: Selected Plays",
    "Create simple literary works": "Creative and Digital Writing",
}

KISWAHILI_TOPIC_MAP = {
    "Kutambua Kiswahili kama kielelezo cha utaifa na utambulisho wa Mtanzania": "Dhana ya Lugha na Mawasiliano",
    "Kukuza uelewa wa sarufi ya Kiswahili": "Sarufi ya Kiswahili: Sauti na Maneno",
    "Kusikiliza na kuelewa mazungumzo": "Ustadi wa Kusikiliza na Kuzungumza",
    "Kuwasiliana kwa ufasaha kwa njia ya mazungumzo": "Ustadi wa Kusikiliza na Kuzungumza",
    "Kusoma matini kwa ufasaha na ufahamu": "Ustadi wa Kusoma",
    "Kutumia kamusi katika miktadha mbalimbali": "Uundaji wa Maneno na Ukuzaji wa Kamusi",
    "Kuwasiliana kwa njia ya maandishi katika miktadha mbalimbali": "Ustadi wa Kuandika",
    "Kukuza uelewa wa misingi ya fasihi ya Kiswahili": "Utangulizi wa Fasihi na Fasihi Simulizi",
    "Kuhakiki kazi za fasihi ya Kiswahili": "Uhakiki wa Vitabu Teule: Riwaya na Tamthilia",
    "Kubuni kazi za fasihi ya Kiswahili": "Uandishi wa Ubunifu na Dijitali",
    "Kufanya tafsiri sahili katika lugha ya Kiswahili": "Utafsiri na Ukalimani",
    "Kuhariri matini mbalimbali za Kiswahili": "Utafsiri na Ukalimani",
    "Kufanya ukalimani sahili kwa lugha ya Kiswahili": "Utafsiri na Ukalimani",
}

# Enrichment maps for the sparser competency-pool subjects (Basic Mathematics,
# Chemistry, Biology). These keep the richer existing per-form skeleton and
# inject the authentic KB lessons into matching topics.
MATHS_TOPIC_MAP = {
    "Use numerical skills in different contexts": "NUMBERS",
    "Use ratios and proportions in daily life": "RATIOS, PROPORTIONS AND PERCENTAGES",
    "Use rates and variations in different contexts": "RATES AND VARIATIONS",
    "Use geometry, approximations, relations and functions in various contexts": "DECIMALS AND APPROXIMATIONS",
    "Use algebra and matrices in problem solving": "ALGEBRA",
    "Use basic coordinate geometry, trigonometry and vectors skills in daily life": "COORDINATE GEOMETRY",
    "Use basic coordinate geometry, trigonometry, and vectors skills in daily life": "TRIGONOMETRY II",
    "Use basic skills of circles in daily life": "MENSURATION",
    "Use sets, sequences and series in problem solving": "SEQUENCES AND SERIES",
    "Use probability in problem solving": "PROBABILITY",
    "Use statistics in problem solving": "STATISTICS AND DATA REPRESENTATION",
}

CHEMISTRY_TOPIC_MAP = {
    "Demonstrate mastery of concepts, theories and principles in Chemistry": "INTRODUCTION TO CHEMISTRY",
    ". Demonstrate mastery of concepts, theories and principles in Chemistry": "SALTS",
    "Demonstrate an understanding of the physical and chemical properties of elements on the basis of their arrangements in the periodic table": "ATOMIC STRUCTURE",
    "Conduct experiments in Chemistry": "INTRODUCTION TO CHEMISTRY",
    "Conduct a project in Chemistry": "INTRODUCTION TO CHEMISTRY",
    "Demonstrate mastery of the principles of extraction of metals": "CHEMICAL REACTIONS",
    "Use the International Union of Pure and Applied Chemistry nomenclature to name chemical species": "ORGANIC CHEMISTRY",
    "Use chemical symbols, formulae and equations to represent chemical reaction": "CHEMICAL REACTIONS",
}

BIOLOGY_TOPIC_MAP = {
    "Describe the physiological, anatomical and ecological processes of living organisms": "BIOLOGY AND ITS APPLICATIONS",
    "Demonstrate mastery of scientific biological terminologies": "BIOLOGY AND ITS APPLICATIONS",
    "Demonstrate mastery of basic skills for conducting biological investigations": "BIOLOGY AND ITS APPLICATIONS",
    "Prepare and present results of biological investigations": "CELL STRUCTURE AND ORGANIZATION",
    "Carry out a biological project work using biological principles": "BIOLOGY AND ITS APPLICATIONS",
}


def enrich_olevel_topics(topics: list[dict], units: list[dict], comp_map: dict) -> tuple[list[dict], list, list]:
    """Inject authentic KB lessons into a per-form skeleton, preserving structure.

    Keeps every existing topic/subtopic/outcome and appends each competence's
    distinct lessons (deduped against existing outcome text and within the KB)
    round-robin across the target topic's subtopics. Returns
    (enriched_topics, assigned_lessons, unmatched_entries).
    """
    # Index target topics by lowercased title (only O-Level; A-Level untouched).
    by_title: dict[str, list[dict]] = {}
    order: dict[str, int] = {}
    for t in topics:
        if t["form_level"] <= 4 and t.get("title"):
            by_title.setdefault(t["title"].lower(), []).append(t)
            order.setdefault(t["title"].lower(), len(order))

    # Collect distinct cleaned lessons per competence and match to a target topic.
    assigned = []
    unmatched = []
    for unit in units:
        for comp in unit.get("topics", []):
            c_title = _clean(comp.get("topic_name"))
            if not c_title or c_title not in comp_map:
                unmatched.append(c_title)
                continue
            target = comp_map[c_title].lower()
            targets = by_title.get(target)
            if not targets:
                unmatched.append(f"{c_title} -> {comp_map[c_title]}")
                continue
            lessons = []
            for l in comp.get("lessons", []):
                txt = _dedupe_active_verb(_clean(l.get("title") or l.get("markdown_content")))
                if txt:
                    lessons.append(txt)
            lessons = list(OrderedDict.fromkeys(lessons))

            # Distribute round-robin across the target topic's subtopics.
            for sp_idx, tgt in enumerate(targets):
                subs = tgt.get("subtopics", [])
                if not subs:
                    continue
                existing = {o[0] for sp in subs for o in sp.get("outcomes", [])
                            if isinstance(o, dict) and o.get("description")}
                # Also track tuple-outcome descriptions.
                for sp in subs:
                    for o in sp.get("outcomes", []):
                        if isinstance(o, (list, tuple)) and o:
                            existing.add(o[0])
                slot = 0
                for lesson in lessons:
                    if lesson in existing:
                        continue
                    sp = subs[slot % len(subs)]
                    sp.setdefault("outcomes", []).append((lesson, "comprehension", 0))
                    existing.add(lesson)
                    assigned.append(lesson)
                    slot += 1

    return topics, assigned, unmatched


def enrich_subject(kb_root: str, slug: str, existing_subject: dict) -> dict | None:
    """Enrich an O-Level per-form skeleton with authentic KB lessons.

    Preserves all existing topics, subtopics, outcomes, period totals, codes and
    A-Level topics; appends the KB competence lessons into matching topics.
    """
    comp_map = {
        "english": ENGLISH_TOPIC_MAP,
        "kiswahili": KISWAHILI_TOPIC_MAP,
        "mathematics": MATHS_TOPIC_MAP,
        "chemistry": CHEMISTRY_TOPIC_MAP,
        "biology": BIOLOGY_TOPIC_MAP,
    }.get(slug)
    if comp_map is None:
        return None
    data = load_kb_o_level(kb_root, slug)
    if not data:
        return None
    topics = existing_subject.get("topics", [])
    enriched, assigned, unmatched = enrich_olevel_topics(topics, data["units"], comp_map)
    subject = dict(existing_subject)
    subject["topics"] = enriched
    # Recompute subtopic order indexes after injection.
    for t in subject["topics"]:
        if t["form_level"] <= 4:
            for sp in t.get("subtopics", []):
                sp["order"] = sp.get("order") or 0
    return {
        "subject": subject,
        "assigned": assigned,
        "unmatched": unmatched,
    }


# Official NECTA subject codes (authoritative; never overridden by KB JSON).
OFFICIAL_NECTA_CODE = {
    "mathematics": "021",
    "english": "011",
    "kiswahili": "012",
    "physics": "031",
    "chemistry": "032",
    "biology": "033",
}

# knowledge-base JSON file name per casuya slug for O-Level.
KB_OLEVEL_FILE = {
    "mathematics": "mathematics_olevel.json",
    "english": "english_olevel.json",
    "kiswahili": "kiswahili_olevel.json",
    "physics": "physics_f1_f4.json",
    "chemistry": "chemistry_olevel.json",
    "biology": "biology_olevel.json",
}


# Common OCR artifacts seen in the parsed TIE PDFs (double letters, stray dots).
_OCR_FIXES = [
    (re.compile(r"(?i)\bifrst\b"), "first"),
    (re.compile(r"(?i)\bscientiifc\b"), "scientific"),
    (re.compile(r"(?i)\bbasicc\b"), "basic"),
    (re.compile(r"(?i)\bexplaain\b"), "explain"),
]


def _clean(text: str | None) -> str:
    """Normalise whitespace and collapse repeated/full-stop noise from OCR."""
    if not text:
        return ""
    text = re.sub(r"\s+", " ", str(text)).strip()
    for pat, repl in _OCR_FIXES:
        text = pat.sub(repl, text)
    return text


def _dedupe_active_verb(text: str) -> str:
    """Collapse accidental doubled leading verbs (e.g. 'Use Use ...')."""
    parts = text.split()
    if len(parts) >= 2 and parts[0].lower() == parts[1].lower():
        del parts[0]
    return " ".join(parts)


def load_kb_o_level(kb_root: str, slug: str) -> dict | None:
    filename = KB_OLEVEL_FILE.get(slug)
    if not filename:
        return None
    path = Path(kb_root) / "syllabi" / "o_level" / filename
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def build_topics_from_units(units: list[dict], *, min_periods: int = 3) -> list[dict]:
    """Turn a cleaned list of (form, unit) tuples into seed topics.

    Each unit becomes a topic; each competence becomes a subtopic; each lesson
    becomes an outcome. Numbering resets per form (topic X.0, subtopic X.Y).
    """
    by_form: dict[int, list[dict]] = OrderedDict()
    for u in units:
        by_form.setdefault(u["form"], []).append(u)

    topics: list[dict] = []
    for form, form_units in by_form.items():
        for ui, u in enumerate(form_units, start=1):
            topic_title = _clean(u["unit_title"])
            subtopics: list[dict] = []
            for si, comp in enumerate(u["competences"], start=1):
                outcome_texts = []
                for lesson in comp["lessons"]:
                    txt = _dedupe_active_verb(_clean(lesson))
                    if txt:
                        outcome_texts.append(txt)
                if not outcome_texts:
                    continue
                outcomes = [
                    (txt, "comprehension", oi)
                    for oi, txt in enumerate(outcome_texts, start=1)
                ]
                subtopics.append({
                    "title": _clean(comp["title"]),
                    "code": f"{ui}.{si}",
                    "order": si,
                    "periods": 0,
                    "outcomes": outcomes,
                })
            if not subtopics:
                # Keep the unit as a topic even if competences were empty but fold
                # nothing; still emit it with a single placeholder subtopic.
                subtopics.append({
                    "title": topic_title,
                    "code": f"{ui}.1",
                    "order": 1,
                    "periods": 0,
                    "outcomes": [],
                })
            topics.append({
                "title": topic_title,
                "code": f"{ui}.0",
                "form_level": form,
                "order": ui,
                "periods": 0,
                "weight": "medium",
                "subtopics": subtopics,
            })
    return topics


def distribute_periods(topics: list[dict], form_totals: dict[int, int]) -> None:
    """Allocate each form's total periods across its topics proportionally to the
    number of subtopics (competences), preserving the original per-form total."""
    by_form: dict[int, list[dict]] = OrderedDict()
    for t in topics:
        by_form.setdefault(t["form_level"], []).append(t)

    for form, form_topics in by_form.items():
        total = form_totals.get(form, 0)
        n_sub = sum(len(t["subtopics"]) for t in form_topics)
        for t in form_topics:
            share = len(t["subtopics"])
            periods = round(total * share / n_sub) if (total and n_sub) else 0
            t["periods"] = periods
            t["weight"] = ("high" if periods >= 12 else
                           "medium" if periods >= 6 else "low")
            if t["subtopics"]:
                base = periods // len(t["subtopics"])
                for i, sp in enumerate(t["subtopics"]):
                    sp["periods"] = base + (1 if i < periods % len(t["subtopics"]) else 0)
            else:
                t["periods"] = periods


def merge_olevel(preserved_o_level: list[dict] | None, new_o_level: list[dict]) -> list[dict]:
    """Combine regenerated O-Level topics with untouched A-Level topics.

    preserved_o_level contains the existing seed's A-Level (Form 5-6) topics.
    """
    alevel = [t for t in (preserved_o_level or []) if t["form_level"] >= 5]
    return new_o_level + alevel


def regenerate_subject(
    kb_root: str,
    slug: str,
    existing_subject: dict,
    *,
    form_totals: dict[int, int] | None = None,
    unit_forms: dict[str, int] | None = None,
    o_level_forms: tuple[int, ...] = (1, 2, 3, 4),
) -> dict | None:
    """Regenerate the O-Level portion of a subject for given KB units.

    kb_root        : root of the knowledge-base folder.
    slug           : casuya subject slug (e.g. "physics").
    existing_subject: the current seed's full subject dict (top-level metadata is
                     preserved; A-Level topics are kept; O-Level topics rebuilt).
    form_totals    : explicit per-form O-Level period totals; if None these are
                     derived from the existing seed's O-Level topics.
    unit_forms     : explicit map of unit_title -> form for subjects whose KB
                     JSON does not carry reliable per-unit forms.
    o_level_forms  : which form levels the KB JSON covers (replaced from KB).
    """
    data = load_kb_o_level(kb_root, slug)
    if not data:
        return None

    # 1. Clean + dedupe units. KB JSON has duplicated units; collapse identical
    #    unit (form, title, competences) into one, merging lesson sets.
    cleaned: dict[tuple, dict] = OrderedDict()
    for unit in data["units"]:
        form = unit.get("form")
        title = _clean(unit.get("unit_title"))
        competences = []
        seen: set[str] = set()
        for comp in unit.get("topics", []):
            c_title = _clean(comp.get("topic_name"))
            if not c_title or c_title.lower() in seen:
                continue
            seen.add(c_title.lower())
            lessons = [
                _clean(l.get("title") or l.get("markdown_content"))
                for l in comp.get("lessons", [])
            ]
            lessons = OrderedDict.fromkeys([x for x in lessons if x]).keys()
            competences.append({"title": c_title, "lessons": list(lessons)})
        if not competences:
            continue
        if unit_forms and title in unit_forms:
            form = unit_forms[title]
        key = (form, title)
        if key in cleaned:
            # merge competences + lessons
            cleaned[key]["competences"].extend(competences)
        else:
            cleaned[key] = {"form": form, "unit_title": title, "competences": competences}
    clean_units = list(cleaned.values())

    # 2. Build O-Level topics.
    new_o_level = build_topics_from_units(clean_units)

    # 3. Periods: use provided totals or derive per-form totals from existing seed.
    existing_topics = existing_subject.get("topics", [])
    if form_totals is None:
        form_totals = {}
        for t in existing_topics:
            if t["form_level"] <= 4:
                form_totals[t["form_level"]] = form_totals.get(t["form_level"], 0) + (t.get("periods") or 0)
    distribute_periods(new_o_level, form_totals)

    # 4. Merge with preserved A-Level.
    topics = merge_olevel(existing_topics, new_o_level)

    subject = dict(existing_subject)
    subject["topics"] = topics
    return subject
