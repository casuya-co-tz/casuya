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
        with zipfile.ZipFile(pkg_path, "r") as zf:
            for member in zf.infolist():
                member_path = Path(member.filename)
                resolved = (output_dir / member_path).resolve()
                if not str(resolved).startswith(str(output_dir.resolve())):
                    raise CasuyaError(f"ZipSlip detected: {member.filename}")
                zf.extract(member, output_dir)
        return output_dir

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
