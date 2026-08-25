import sys
import os
import tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from casuya_core.signatures import generate_signatures, verify_signatures, finalize_package_hash
from casuya_core.exceptions import SignatureError


def test_generate_signatures():
    with tempfile.TemporaryDirectory() as d:
        f = os.path.join(d, "test.txt")
        with open(f, "w") as fh:
            fh.write("hello")
        sigs = generate_signatures(d)
        assert "test.txt" in sigs["files"]
        assert len(sigs["files"]["test.txt"]) == 64


def test_verify_signatures_passes():
    with tempfile.TemporaryDirectory() as d:
        f = os.path.join(d, "test.txt")
        with open(f, "w") as fh:
            fh.write("hello")
        sigs = generate_signatures(d)
        assert verify_signatures(d, sigs) == True


def test_verify_signatures_fails_on_tamper():
    with tempfile.TemporaryDirectory() as d:
        f = os.path.join(d, "test.txt")
        with open(f, "w") as fh:
            fh.write("hello")
        sigs = generate_signatures(d)
        with open(f, "w") as fh:
            fh.write("tampered")
        try:
            verify_signatures(d, sigs)
            assert False, "Should have raised"
        except SignatureError:
            pass


def test_generate_signatures_structure():
    with tempfile.TemporaryDirectory() as d:
        sigs = generate_signatures(d)
        assert sigs["version"] == "1.0"
        assert sigs["algorithm"] == "sha256"
        assert "files" in sigs
        assert "package_hash" in sigs


if __name__ == "__main__":
    test_generate_signatures()
    test_verify_signatures_passes()
    test_verify_signatures_fails_on_tamper()
    test_generate_signatures_structure()
    print("All signature tests passed")
