from typing import Dict, Any, Callable, List
from .versioning import Version, compare_versions


def _version_sort_key(m: "Migration") -> tuple:
    v = Version.parse(m.from_version)
    return (v.major, v.minor, v.patch)


class Migration:
    def __init__(self, from_version: str, to_version: str, fn: Callable[[Dict[str, Any]], Dict[str, Any]]):
        self.from_version = from_version
        self.to_version = to_version
        self.fn = fn


_migration_registry: List[Migration] = []


def register_migration(from_version: str, to_version: str):
    def decorator(fn):
        _migration_registry.append(Migration(from_version, to_version, fn))
        return fn
    return decorator


def get_migration_path(current: str, target: str) -> List[Migration]:
    path = []
    remaining = [m for m in sorted(_migration_registry, key=_version_sort_key)]
    version = current
    while compare_versions(version, target) < 0:
        applied = False
        for m in remaining:
            if compare_versions(m.from_version, version) == 0:
                path.append(m)
                version = m.to_version
                applied = True
                break
        if not applied:
            raise ValueError(f"No migration path from {current} to {target}")
    return path


def migrate_manifest(manifest: Dict[str, Any], target_version: str) -> Dict[str, Any]:
    current = manifest.get("manifest_version", "1.0.0")
    if compare_versions(current, target_version) >= 0:
        return manifest
    path = get_migration_path(current, target_version)
    result = manifest
    for m in path:
        result = m.fn(result)
    return result
