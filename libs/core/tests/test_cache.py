import sys
import os
import tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from casuya_core.cache import BuildCache


def test_cache_set_and_get():
    with tempfile.TemporaryDirectory() as d:
        cache = BuildCache(cache_dir=d)
        test_file = os.path.join(d, "source.html")
        with open(test_file, "w") as f:
            f.write("<html></html>")
        data = b"minified output"
        config_hash = "abc123"
        cache.set(test_file, config_hash, data)
        result = cache.get(test_file, config_hash)
        assert result == data


def test_cache_miss():
    with tempfile.TemporaryDirectory() as d:
        cache = BuildCache(cache_dir=d)
        test_file = os.path.join(d, "source.html")
        with open(test_file, "w") as f:
            f.write("<html></html>")
        result = cache.get(test_file, "nonexistent")
        assert result is None


def test_cache_clear():
    with tempfile.TemporaryDirectory() as d:
        cache = BuildCache(cache_dir=d)
        test_file = os.path.join(d, "source.html")
        with open(test_file, "w") as f:
            f.write("<html></html>")
        cache.set(test_file, "cfg", b"data")
        cache.clear()
        assert len(os.listdir(d)) == 0


if __name__ == "__main__":
    test_cache_set_and_get()
    test_cache_miss()
    print("All cache tests passed")
