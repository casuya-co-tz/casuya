import hashlib
from pathlib import Path
from typing import Optional, Union
from .utils import calculate_file_hash


class BuildCache:
    def __init__(self, cache_dir: Optional[Union[Path, str]] = None):
        self.cache_dir = Path(cache_dir) if cache_dir else Path.home() / ".casuya" / "cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _key_for(self, file_path: Path, config_hash: str) -> str:
        content_hash = calculate_file_hash(file_path)
        return hashlib.sha256(f"{content_hash}:{config_hash}".encode()).hexdigest()

    def get(self, file_path: Path, config_hash: str) -> Optional[bytes]:
        key = self._key_for(file_path, config_hash)
        cache_file = self.cache_dir / key
        if cache_file.exists():
            return cache_file.read_bytes()
        return None

    def set(self, file_path: Path, config_hash: str, data: bytes) -> None:
        key = self._key_for(file_path, config_hash)
        cache_file = self.cache_dir / key
        cache_file.write_bytes(data)

    def invalidate(self, file_path: Path) -> None:
        content_hash = calculate_file_hash(file_path)
        for f in self.cache_dir.iterdir():
            if f.name.startswith(content_hash):
                f.unlink()

    def clear(self) -> None:
        for f in self.cache_dir.iterdir():
            if f.is_file():
                f.unlink()
