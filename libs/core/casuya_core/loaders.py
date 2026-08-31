import zipfile
import json
from pathlib import Path
from typing import Dict, Any, Optional, Union
from .exceptions import CasuyaError
from .constants import PKG_EXTENSION, MANIFEST_FILENAME, METADATA_FILENAME, SIGNATURE_FILENAME


class PackageLoader:
    def __init__(self):
        self._loaded = {}

    def load_package(self, pkg_path: Union[Path, str]) -> Dict[str, Any]:
        pkg_path = Path(pkg_path)
        if not pkg_path.exists():
            raise CasuyaError(f"Package not found: {pkg_path}")
        if pkg_path.suffix != PKG_EXTENSION:
            raise CasuyaError(f"Not a valid package file: {pkg_path}")

        with zipfile.ZipFile(pkg_path, "r") as zf:
            names = zf.namelist()
            result = {}
            for name in names:
                result[name] = zf.read(name)
        self._loaded[str(pkg_path)] = result
        return result

    def extract_to(self, pkg_path: Union[Path, str], output_dir: Union[Path, str]) -> Path:
        pkg_path = Path(pkg_path)
        output_dir = Path(output_dir)
        base_dir = output_dir.resolve()
        base_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(pkg_path, "r") as zf:
            total_size = 0
            for member in zf.infolist():
                member_path = Path(member.filename)
                # Reject absolute paths and any path traversal components outright.
                if member_path.is_absolute() or ".." in member_path.parts:
                    raise CasuyaError(f"ZipSlip detected: {member.filename}")
                if member.is_symlink():
                    raise CasuyaError(f"Symlink member not allowed: {member.filename}")
                dest = (base_dir / member_path).resolve()
                try:
                    dest.relative_to(base_dir)
                except ValueError:
                    raise CasuyaError(f"ZipSlip detected: {member.filename}")
                # Guard against decompression bombs: cap total uncompressed bytes.
                total_size += member.file_size
                if total_size > MAX_UNPACKED_BYTES:
                    raise CasuyaError("Package exceeds maximum safe unpacked size")
                zf.extract(member, base_dir)
        return base_dir

    def get_manifest(self, pkg_path: Path) -> Optional[Dict[str, Any]]:
        data = self._loaded.get(str(pkg_path))
        if data is None:
            data = self.load_package(pkg_path)
        raw = data.get(MANIFEST_FILENAME)
        if raw:
            return json.loads(raw.decode("utf-8"))
        return None

    def get_metadata(self, pkg_path: Path) -> Optional[Dict[str, Any]]:
        data = self._loaded.get(str(pkg_path))
        if data is None:
            data = self.load_package(pkg_path)
        raw = data.get(METADATA_FILENAME)
        if raw:
            return json.loads(raw.decode("utf-8"))
        return None

    def get_signatures(self, pkg_path: Path) -> Optional[Dict[str, Any]]:
        data = self._loaded.get(str(pkg_path))
        if data is None:
            data = self.load_package(pkg_path)
        raw = data.get(SIGNATURE_FILENAME)
        if raw:
            return json.loads(raw.decode("utf-8"))
        return None
