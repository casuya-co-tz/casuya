import hashlib
from pathlib import Path
from typing import Dict, Optional
from .utils import calculate_file_hash
from .exceptions import SignatureError


def generate_signatures(build_dir: Path) -> Dict:
    build_dir = Path(build_dir)
    signatures = {}
    for file_path in sorted(build_dir.rglob("*")):
        if file_path.is_file():
            rel_path = str(file_path.relative_to(build_dir))
            signatures[rel_path] = calculate_file_hash(file_path)
    return {
        "version": "1.0",
        "algorithm": "sha256",
        "files": signatures,
        "package_hash": "pending",
    }


def finalize_package_hash(pkg_path: Path, signatures: Dict) -> str:
    pkg_hash = calculate_file_hash(pkg_path)
    signatures["package_hash"] = pkg_hash
    return pkg_hash


def verify_signatures(build_dir: Path, expected: Dict) -> bool:
    build_dir = Path(build_dir)
    algorithm = expected.get("algorithm", "sha256")
    for rel_path, expected_hash in expected.get("files", {}).items():
        file_path = build_dir / rel_path
        if not file_path.exists():
            raise SignatureError(f"File missing: {rel_path}")
        actual_hash = calculate_file_hash(file_path, algorithm)
        if actual_hash != expected_hash:
            raise SignatureError(f"Hash mismatch for {rel_path}: expected {expected_hash}, got {actual_hash}")
    return True


def verify_package_integrity(pkg_path: Path, signatures: Optional[Dict] = None) -> bool:
    if signatures is None:
        return True
    expected_pkg_hash = signatures.get("package_hash", "")
    if not expected_pkg_hash or expected_pkg_hash == "pending":
        return True
    actual_hash = calculate_file_hash(pkg_path)
    if actual_hash != expected_pkg_hash:
        raise SignatureError(f"Package hash mismatch: package may be corrupted")
    return True
