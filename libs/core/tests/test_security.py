import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from casuya_core.security import SecurityValidator
from casuya_core.exceptions import ValidationError


def test_detects_inline_javascript():
    sv = SecurityValidator()
    errors = sv.validate_html_content('<a href="javascript:alert(1)">click</a>')
    assert len(errors) > 0
    assert any("javascript:" in e for e in errors)


def test_detects_onerror():
    sv = SecurityValidator()
    errors = sv.validate_html_content('<img src="x" onerror="alert(1)">')
    assert len(errors) > 0
    assert any("onerror" in e for e in errors)


def test_detects_script_tag():
    sv = SecurityValidator()
    errors = sv.validate_html_content("<script>alert(1)</script>")
    assert len(errors) > 0
    assert any("script" in e.lower() for e in errors)


def test_detects_eval():
    sv = SecurityValidator()
    errors = sv.validate_html_content("<script>eval('alert(1)')</script>")
    assert any("eval" in e for e in errors)


def test_clean_html_passes():
    sv = SecurityValidator()
    errors = sv.validate_html_content("<html><body><p>Safe content</p></body></html>")
    assert len(errors) == 0


def test_validate_manifest_security():
    sv = SecurityValidator()
    errors = sv.validate_manifest_security({"id": "test", "version": "1.0.0"})
    assert len(errors) == 0


def test_validate_manifest_missing_id():
    sv = SecurityValidator()
    errors = sv.validate_manifest_security({"version": "1.0.0"})
    assert len(errors) > 0


def test_validate_all_raises_on_dangerous():
    sv = SecurityValidator()
    try:
        sv.validate_all(
            '<script>alert(1)</script>',
            {"id": "test", "version": "1.0.0"},
            os.path.join(os.path.dirname(__file__), ".."),
        )
        assert False, "Should have raised"
    except ValidationError:
        pass


if __name__ == "__main__":
    test_detects_inline_javascript()
    test_detects_onerror()
    test_detects_script_tag()
    test_detects_eval()
    test_clean_html_passes()
    test_validate_manifest_security()
    test_validate_manifest_missing_id()
    test_validate_all_raises_on_dangerous()
    print("All security tests passed")
