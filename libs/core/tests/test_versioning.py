import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from casuya_core.versioning import Version, compare_versions, is_compatible


def test_version_parse():
    v = Version.parse("1.2.3")
    assert v.major == 1
    assert v.minor == 2
    assert v.patch == 3
    assert str(v) == "1.2.3"


def test_version_parse_with_pre():
    v = Version.parse("2.0.0-beta.1")
    assert v.pre == "beta.1"
    assert str(v) == "2.0.0-beta.1"


def test_version_parse_with_build():
    v = Version.parse("1.0.0+build123")
    assert v.build == "build123"
    assert str(v) == "1.0.0+build123"


def test_version_bump_major():
    v = Version.parse("1.2.3").bump_major()
    assert str(v) == "2.0.0"


def test_version_bump_minor():
    v = Version.parse("1.2.3").bump_minor()
    assert str(v) == "1.3.0"


def test_version_bump_patch():
    v = Version.parse("1.2.3").bump_patch()
    assert str(v) == "1.2.4"


def test_compare_versions_equal():
    assert compare_versions("1.0.0", "1.0.0") == 0


def test_compare_versions_greater():
    assert compare_versions("2.0.0", "1.0.0") == 1


def test_compare_versions_less():
    assert compare_versions("1.0.0", "2.0.0") == -1


def test_is_compatible():
    assert is_compatible("1.2.0", "1.1.0") == True
    assert is_compatible("1.2.3", "1.2.3") == True
    assert is_compatible("2.0.0", "1.9.9") == False


def test_invalid_version():
    try:
        Version.parse("not.a.version")
        assert False, "Should have raised"
    except ValueError:
        pass


if __name__ == "__main__":
    test_version_parse()
    test_version_parse_with_pre()
    test_version_parse_with_build()
    test_version_bump_major()
    test_version_bump_minor()
    test_version_bump_patch()
    test_compare_versions_equal()
    test_compare_versions_greater()
    test_compare_versions_less()
    test_is_compatible()
    test_invalid_version()
    print("All versioning tests passed")
