import sys
import os
import tempfile
import zipfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from casuya_core.loaders import PackageLoader


def test_load_package():
    with tempfile.TemporaryDirectory() as d:
        pkg_path = os.path.join(d, "test.pkg")
        with zipfile.ZipFile(pkg_path, "w") as zf:
            zf.writestr("content/index.html", "<html></html>")
        loader = PackageLoader()
        data = loader.load_package(pkg_path)
        assert "content/index.html" in data
        assert data["content/index.html"] == b"<html></html>"


def test_extract_to():
    with tempfile.TemporaryDirectory() as d:
        pkg_path = os.path.join(d, "test.pkg")
        with zipfile.ZipFile(pkg_path, "w") as zf:
            zf.writestr("content/index.html", "<html></html>")
        out = os.path.join(d, "extracted")
        loader = PackageLoader()
        result = loader.extract_to(pkg_path, out)
        assert os.path.isdir(out)
        assert os.path.exists(os.path.join(out, "content", "index.html"))


if __name__ == "__main__":
    test_load_package()
    test_extract_to()
    print("All loader tests passed")
