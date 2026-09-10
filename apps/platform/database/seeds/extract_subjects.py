"""Extract NECTA syllabus data from seed_necta_syllabus.py into per-subject JSON files.

Run once to generate the JSON files in data/:
    python -m database.seeds.extract_subjects
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Add platform dir to path so we can import the seed module
PLATFORM_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PLATFORM_DIR))

from database.seeds.seed_necta_syllabus import NECTA_SYLLABUS


def _convert(obj):
    """Recursively convert tuples to lists for JSON serialization."""
    if isinstance(obj, tuple):
        return [_convert(item) for item in obj]
    if isinstance(obj, list):
        return [_convert(item) for item in obj]
    if isinstance(obj, dict):
        return {k: _convert(v) for k, v in obj.items()}
    return obj


def main():
    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(exist_ok=True)

    for subject in NECTA_SYLLABUS:
        slug = subject["slug"]
        filename = f"{slug}.json"
        filepath = out_dir / filename

        data = _convert(subject)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        topic_count = len(data.get("topics", []))
        subtopic_count = sum(len(t.get("subtopics", [])) for t in data.get("topics", []))
        print(f"  {filename:30s}  {topic_count:3d} topics  {subtopic_count:4d} subtopics")

    print(f"\nExtracted {len(NECTA_SYLLABUS)} subjects to {out_dir}/")


if __name__ == "__main__":
    main()
