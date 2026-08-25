from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any
import uuid
from .constants import DEFAULT_VERSION, MANIFEST_FILENAME
from .utils import calculate_file_hash
from .parsers import AssetParser


def create_manifest(html_path: Path, metadata: Dict[str, Any]) -> Dict[str, Any]:
    lesson_id = f"LESSON-{uuid.uuid4().hex[:8].upper()}"
    manifest = {
        "manifest_version": "1.0.0",
        "id": lesson_id,
        "title": metadata.get("title", html_path.stem.replace("_", " ").title()),
        "subject": metadata.get("subject", "General"),
        "version": DEFAULT_VERSION,
        "language": metadata.get("language", "en"),
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "content_hash": calculate_file_hash(html_path),
        "educational": {
            "difficulty": metadata.get("difficulty", "Medium"),
            "duration_minutes": metadata.get("duration_minutes", 30),
            "grade_level": metadata.get("grade_level", ""),
            "prerequisites": metadata.get("prerequisites", ""),
            "learning_objectives": metadata.get("learning_objectives", ""),
            "tags": metadata.get("tags", []),
        },
        "dependencies": [],
        "assets": [],
    }
    return manifest


def enrich_manifest_with_assets(manifest: Dict[str, Any], build_dir: Path) -> Dict[str, Any]:
    parser = AssetParser()
    assets = parser.collect_assets(build_dir)
    manifest["assets"] = assets
    return manifest
