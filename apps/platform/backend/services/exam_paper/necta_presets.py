"""Load NECTA paper presets shared with packages/ai knowledge base."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

def _resolve_presets_dir() -> Path:
    """Locate preset JSON — monorepo dev tree or bundled backend/data copy."""
    here = Path(__file__).resolve()
    bundled = here.parents[2] / "data" / "necta_presets"
    if bundled.is_dir():
        return bundled
    for ancestor in here.parents:
        candidate = ancestor / "packages" / "ai" / "knowledge_base" / "exam_formats" / "presets"
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError(
        "NECTA preset catalog not found. Expected backend/data/necta_presets or "
        "packages/ai/knowledge_base/exam_formats/presets."
    )


_PRESETS_DIR = _resolve_presets_dir()

_ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI"}

_PRESET_FILES = {
    ("csee", "physics"): "csee_physics.json",
    ("csee", "chemistry"): "csee_chemistry.json",
    ("csee", "mathematics"): "csee_basic_mathematics.json",
    ("ftna", "physics"): "ftna_physics.json",
    ("ftna", "chemistry"): "ftna_chemistry.json",
    ("ftna", "mathematics"): "ftna_mathematics.json",
    ("acsee", "physics"): "acsee_physics.json",
    ("acsee", "chemistry"): "acsee_chemistry.json",
    ("acsee", "mathematics"): "acsee_advanced_mathematics.json",
}

_file_cache: dict[str, dict[str, Any]] = {}


def _load_json(name: str) -> dict[str, Any]:
    path = _PRESETS_DIR / name
    return json.loads(path.read_text(encoding="utf-8"))


def form_family(form_level: int) -> str:
    if form_level <= 2:
        return "ftna"
    if form_level <= 4:
        return "csee"
    return "acsee"


def form_label(form_level: int) -> str:
    return f"Form {_ROMAN.get(max(1, min(6, form_level)), 'I')}"


def _scale_key(family: str, subject_slug: str, paper: str) -> str | None:
    if paper != "theory":
        return None
    if family == "csee":
        return "csee_math" if subject_slug == "mathematics" else "csee_science"
    if family == "ftna":
        return "ftna_math" if subject_slug == "mathematics" else "ftna_science"
    if family == "acsee":
        return "acsee_math" if subject_slug == "mathematics" else "acsee_science_p1"
    return None


def _apply_scale(base: dict[str, Any], test_type: str) -> dict[str, Any]:
    if test_type not in ("topical", "monthly"):
        return base
    scale_file = _load_json("internal_scale.json")
    block = scale_file.get(test_type, {})
    key = _scale_key(base["family"], base["subject_slug"], base["paper"])
    if not key or key not in block:
        return base
    scaled = deepcopy(base)
    override = block[key]
    scaled["duration"] = override.get("duration", scaled["duration"])
    scaled["total_marks"] = override.get("total_marks", scaled["total_marks"])
    if override.get("assessor_table"):
        scaled["assessor_table"] = override["assessor_table"]
    if override.get("flat_questions"):
        scaled["flat_questions"] = deepcopy(override["flat_questions"])
        scaled.pop("sections", None)
    elif override.get("sections"):
        scaled["sections"] = deepcopy(override["sections"])
        scaled.pop("flat_questions", None)
    return scaled


def _slots_from_raw(raw: dict[str, Any], file: dict[str, Any], paper: str) -> dict[str, Any]:
    return {
        "id": f"{file['family']}_{file['subject_slug']}_{paper}",
        "family": file["family"],
        "subject_slug": file["subject_slug"],
        "subject_name": file["subject_name"],
        "subject_code": file["subject_code"],
        "paper": paper,
        "paper_code": raw.get("paper_code", file["subject_code"]),
        "paper_title": raw.get("paper_title", file["subject_name"]),
        "duration": raw.get("duration", "2 Hours"),
        "total_marks": raw.get("total_marks", 100),
        "exam_body": raw.get("exam_body", "NATIONAL EXAMINATIONS COUNCIL OF TANZANIA"),
        "assessment_type": raw.get("assessment_type", "EXAMINATION (PRACTICE)"),
        "id_label": raw.get("id_label", "Examination Number"),
        "candidate_kind": raw.get("candidate_kind", ""),
        "materials": raw.get("materials") or [],
        "constants": raw.get("constants") or [],
        "instructions": raw.get("instructions") or [],
        "confidential": bool(raw.get("confidential")),
        "assessor_table": raw.get("assessor_table"),
        "sections": deepcopy(raw.get("sections")),
        "flat_questions": deepcopy(raw.get("flat_questions")),
        "choice": raw.get("choice"),
    }


def resolve_paper_preset(
    subject_slug: str,
    form_level: int,
    test_type: str,
    paper: str = "theory",
) -> dict[str, Any] | None:
    subject = (subject_slug or "").lower()
    if subject not in ("physics", "chemistry", "mathematics"):
        return None
    family = form_family(form_level)
    cache_key = f"{family}:{subject}"
    if cache_key not in _file_cache:
        fname = _PRESET_FILES.get((family, subject))
        if not fname:
            return None
        _file_cache[cache_key] = _load_json(fname)
    file = _file_cache[cache_key]
    raw_paper = (file.get("papers") or {}).get(paper)
    if not raw_paper:
        return None
    base = _slots_from_raw(raw_paper, file, paper)
    return _apply_scale(base, test_type)


def list_available_papers(subject_slug: str, form_level: int, test_type: str) -> list[dict[str, Any]]:
    subject = (subject_slug or "").lower()
    family = form_family(form_level)
    cache_key = f"{family}:{subject}"
    if cache_key not in _file_cache:
        fname = _PRESET_FILES.get((family, subject))
        if not fname:
            return []
        _file_cache[cache_key] = _load_json(fname)
    file = _file_cache[cache_key]
    papers = file.get("papers") or {}
    variants = ["theory"]
    if "theory_2" in papers:
        variants.append("theory_2")
    if subject != "mathematics" and "practical" in papers:
        variants.append("practical")

    out: list[dict[str, Any]] = []
    for variant in variants:
        preset = resolve_paper_preset(subject, form_level, test_type, variant)
        if not preset:
            continue
        slots = preset.get("flat_questions") or []
        if not slots and preset.get("sections"):
            for sec in preset["sections"]:
                slots.extend(sec.get("questions") or [])
        summary = ""
        if preset.get("sections"):
            summary = " · ".join(
                f"Sec {s['id']}: {len(s.get('questions') or [])} Q ({s.get('marks', 0)} marks)"
                for s in preset["sections"]
            )
        else:
            summary = f"{len(slots)} questions"
        out.append(
            {
                "id": preset["id"],
                "paper": variant,
                "paper_code": preset["paper_code"],
                "paper_title": preset["paper_title"],
                "duration": preset["duration"],
                "total_marks": preset["total_marks"],
                "question_count": len(slots),
                "structure_summary": summary,
                "available": True,
            }
        )
    return out
