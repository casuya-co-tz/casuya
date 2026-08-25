import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from casuya_core.migrations import register_migration, migrate_manifest


@register_migration("1.0.0", "1.1.0")
def add_deps_field(manifest):
    manifest["dependencies"] = []
    manifest["manifest_version"] = "1.1.0"
    return manifest


@register_migration("1.1.0", "2.0.0")
def add_assets_field(manifest):
    manifest["assets"] = {}
    manifest["manifest_version"] = "2.0.0"
    return manifest


def test_migrate_manifest():
    manifest = {"id": "LESSON-TEST", "manifest_version": "1.0.0"}
    result = migrate_manifest(manifest, "2.0.0")
    assert result["manifest_version"] == "2.0.0"
    assert "dependencies" in result
    assert "assets" in result


def test_no_migration_needed():
    manifest = {"id": "LESSON-TEST", "manifest_version": "2.0.0"}
    result = migrate_manifest(manifest, "1.0.0")
    assert result["manifest_version"] == "2.0.0"


if __name__ == "__main__":
    test_migrate_manifest()
    test_no_migration_needed()
    print("All migration tests passed")
