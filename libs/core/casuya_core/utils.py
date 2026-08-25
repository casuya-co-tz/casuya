"""
Shared utility functions for Casuya Core.
"""
import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional
import zipfile

from .exceptions import CasuyaError


def setup_logging(level: str = "INFO"):
    """Setup basic logging."""
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )


def calculate_file_hash(file_path: Path, algorithm: str = "sha256") -> str:
    """Calculate hash of a file."""
    hash_func = hashlib.new(algorithm)
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_func.update(chunk)
    return hash_func.hexdigest()


def calculate_dict_hash(data: Dict[str, Any], algorithm: str = "sha256") -> str:
    """Calculate hash of a dictionary (sorted for consistency)."""
    sorted_json = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.new(algorithm, sorted_json.encode()).hexdigest()


def create_zip_package(source_dir: Path, output_path: Path, compression: int = zipfile.ZIP_DEFLATED):
    """Create a zip package from directory."""
    with zipfile.ZipFile(output_path, "w", compression=compression) as zf:
        for root, _, files in os.walk(source_dir):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(source_dir)
                zf.write(file_path, arcname)


def load_json_file(file_path: Path) -> Dict[str, Any]:
    """Load JSON file safely."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        raise CasuyaError(f"Failed to load JSON from {file_path}: {e}") from e


def save_json_file(data: Dict[str, Any], file_path: Path, indent: int = 2):
    """Save data to JSON file."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=indent, ensure_ascii=False)