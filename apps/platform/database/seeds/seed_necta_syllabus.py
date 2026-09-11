"""Seed the database with the official NECTA/TIE syllabus for all CSEE core subjects.

This module loads the EXACT topic and subtopic structure from the Tanzania
Institute of Education (TIE) syllabus for Ordinary Secondary Education (Form I-IV).
The AI agent uses this data to serve curriculum-aligned content to students.

Subject data is stored as individual JSON files in ``data/`` (one per subject).
Use ``extract_subjects.py`` to regenerate them from the canonical source.

Sources:
- TIE Basic Mathematics Syllabus Form I-IV (2005, Reprinted 2017)
- TIE Physics Syllabus Form I-IV
- TIE Chemistry Syllabus Form I-IV
- NECTA CSEE Examination Formats 2022/2023
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from backend.config.database import get_db, init_db
from backend.models.syllabus import (
    LearningOutcome,
    SyllabusSubject,
    SyllabusSubtopic,
    SyllabusTopic,
)

_DATA_DIR = Path(__file__).parent / "data"

# Form levels currently in scope. Only topics inside this window are seeded;
# higher forms are left untouched (additive, never deleted) until the window
# is widened.
SEED_FORM_MIN = 1
SEED_FORM_MAX = 2


def _uuid() -> str:
    return str(uuid.uuid4())


def _load_syllabus() -> list[dict]:
    """Load all subject JSON files from data/ and return as a list."""
    subjects = []
    for filepath in sorted(_DATA_DIR.glob("*.json")):
        with open(filepath, encoding="utf-8") as f:
            subjects.append(json.load(f))
    return subjects


# ---------------------------------------------------------------------------
# Complete NECTA/TIE syllabus data — loaded from per-subject JSON files.
# Each entry: {name, code, slug, necta_code, is_core, topics: [...]}
# Each topic: {title, code, form_level, order, periods, weight, subtopics: [...]}
# Each subtopic: {title, code, order, periods, outcomes: [[desc, cog_level, order], ...]}
# ---------------------------------------------------------------------------

NECTA_SYLLABUS: list[dict] = _load_syllabus()


def _new_subject(
    db: Session,
    subj_data: dict,
    form_min: int = SEED_FORM_MIN,
    form_max: int = SEED_FORM_MAX,
) -> SyllabusSubject:
    """Create a brand-new subject row with all its topics, subtopics and outcomes."""
    subject = SyllabusSubject(
        id=_uuid(),
        name=subj_data["name"],
        code=subj_data["code"],
        slug=subj_data["slug"],
        description=subj_data.get("description"),
        necta_code=subj_data.get("necta_code"),
        form_start=subj_data.get("form_start", 1),
        form_end=subj_data.get("form_end", 4),
        is_core=subj_data.get("is_core", True),
    )
    db.add(subject)
    db.flush()
    _seed_topics(db, subject, subj_data, form_min=form_min, form_max=form_max)
    return subject


def _seed_topics(
    db: Session,
    subject: SyllabusSubject,
    subj_data: dict,
    form_min: int = SEED_FORM_MIN,
    form_max: int = SEED_FORM_MAX,
) -> int:
    """Seed topics for an existing (or just-created) subject.

    Only topics within the ``[form_min, form_max]`` window are seeded; higher
    forms are never created or modified here. Topics already present (matched
    by title + form_level for the subject) are skipped; missing topics —
    including their subtopics and learning outcomes — are appended. Returns the
    number of topics newly added.

    When ``replace_topic_form_levels`` is declared, the topics in the seed
    data for those form levels (still bounded by the form window) are treated
    as the authoritative set: existing topics whose subtopic titles differ
    from the seed are refreshed, and topics absent from the seed are removed.
    Keep the in-window database in sync with the NECTA/TIE data source on
    every run. Forms outside the window are never created or modified here.
    """
    replace_levels = set(range(form_min, form_max + 1)) | {
        f
        for f in (subj_data.get("replace_topic_form_levels") or [])
        if form_min <= f <= form_max
    }
    existing = {
        (t.subject_id, t.title, t.form_level)
        for t in db.query(SyllabusTopic).filter(SyllabusTopic.subject_id == subject.id).all()
    }
    topics_by_key = {
        (t.subject_id, t.title, t.form_level): t
        for t in db.query(SyllabusTopic).filter(SyllabusTopic.subject_id == subject.id).all()
    }
    authoritative = set()
    added = 0
    for topic_data in subj_data.get("topics", []):
        form_level = topic_data["form_level"]
        if not (form_min <= form_level <= form_max):
            continue
        key = (subject.id, topic_data["title"], form_level)
        if form_level in replace_levels:
            authoritative.add(key)
        current = topics_by_key.get(key)
        if current is not None:
            if form_level in replace_levels:
                seed_subtopics = {s["title"] for s in topic_data.get("subtopics", [])}
                db_subtopics = {st.title for st in current.subtopics}
                if db_subtopics != seed_subtopics:
                    db.delete(current)
                    db.flush()
                    current = None
            if current is not None:
                continue
        existing.add(key)
        topic = SyllabusTopic(
            id=_uuid(),
            subject_id=subject.id,
            title=topic_data["title"],
            code=topic_data.get("code"),
            description=topic_data.get("description"),
            form_level=topic_data["form_level"],
            order_index=topic_data.get("order", 0),
            estimated_periods=topic_data.get("periods"),
            necta_weight=topic_data.get("weight"),
        )
        db.add(topic)
        db.flush()

        for sub_data in topic_data.get("subtopics", []):
            subtopic = SyllabusSubtopic(
                id=_uuid(),
                topic_id=topic.id,
                title=sub_data["title"],
                code=sub_data.get("code"),
                description=sub_data.get("description"),
                order_index=sub_data.get("order", 0),
                estimated_periods=sub_data.get("periods"),
            )
            db.add(subtopic)
            db.flush()

            for i, (outcome_desc, cog_level, order) in enumerate(sub_data.get("outcomes", [])):
                outcome = LearningOutcome(
                    id=_uuid(),
                    subtopic_id=subtopic.id,
                    description=outcome_desc,
                    cognitive_level=cog_level,
                    order_index=order if order else i + 1,
                )
                db.add(outcome)
        added += 1

    if replace_levels:
        stale = (
            db.query(SyllabusTopic)
            .filter(
                SyllabusTopic.subject_id == subject.id,
                SyllabusTopic.form_level.in_(replace_levels),
            )
            .all()
        )
        for topic in stale:
            if (topic.subject_id, topic.title, topic.form_level) not in authoritative:
                db.delete(topic)
        db.flush()
    return added


def run(
    form_min: int = SEED_FORM_MIN,
    form_max: int = SEED_FORM_MAX,
) -> None:
    """Seed the NECTA/TIE syllabus data into the database.

    Only topics in the ``[form_min, form_max]`` form window are seeded (the
    default is Form I-II); topics in higher forms are never created, replaced
    or removed here. Additive at topic level within the window: existing
    subjects are updated, brand-new subjects are created whole. Subjects may
    declare replace_topic_form_levels to make the seed data the authoritative
    topic set for those form levels (still bounded by the window). Safe to
    re-run in local and production environments.
    """
    init_db()
    db: Session = next(get_db())
    try:
        subjects_by_code = {
            s.code: s for s in db.query(SyllabusSubject).all()
        }
        new_subjects = 0
        new_topics = 0
        for subj_data in NECTA_SYLLABUS:
            code = subj_data["code"]
            existing = subjects_by_code.get(code)
            try:
                if existing is None:
                    _new_subject(db, subj_data, form_min=form_min, form_max=form_max)
                    subjects_by_code[code] = db.query(SyllabusSubject).filter(
                        SyllabusSubject.code == code
                    ).one()
                    new_subjects += 1
                    print(f"  [OK] Seeded {subj_data['name']} ({code})")
                    db.commit()
                    continue

                # Widen the form range if the syllabus now spans more forms.
                if subj_data.get("form_end", 4) > existing.form_end:
                    existing.form_end = subj_data["form_end"]
                if subj_data.get("form_start", 1) < existing.form_start:
                    existing.form_start = subj_data["form_start"]
                if subj_data.get("description"):
                    existing.description = subj_data["description"]

                added = _seed_topics(
                    db, existing, subj_data, form_min=form_min, form_max=form_max
                )
                new_topics += added
                db.commit()
                if added:
                    print(f"  [OK] {subj_data['name']} ({code}) appended {added} new topic(s)")
            except Exception:
                db.rollback()
                raise

        print()
        print(f"  NECTA/TIE syllabus seeded successfully "
              f"({new_subjects} new subject(s), {new_topics} new topic(s), "
              f"forms {form_min}-{form_max})!")
        print()

        # Print summary
        total_subjects = db.query(SyllabusSubject).count()
        total_topics = db.query(SyllabusTopic).count()
        total_subtopics = db.query(SyllabusSubtopic).count()
        total_outcomes = db.query(LearningOutcome).count()

        print(f"  Subjects:    {total_subjects}")
        print(f"  Topics:      {total_topics}")
        print(f"  Subtopics:   {total_subtopics}")
        print(f"  Outcomes:    {total_outcomes}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
