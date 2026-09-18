"""Smoke tests for the Casuya Math OCR microservice.

These stub the Pix2Text engine so the suite runs without the heavy `torch` /
`pix2text` wheels or the baked-in model. Run from this file's dir with:

    pip install -r ../requirements.txt
    pytest tests

The full on-disk engine (Pix2Text + CPU torch) is exercised in the Docker
build / on Railway; see the Dockerfile.
"""

from __future__ import annotations

import base64

import pytest
from app import app as fastapi_app
from app.config import get_settings
from fastapi.testclient import TestClient

client = TestClient(fastapi_app)

# 1x1 transparent PNG (well under the 512 KB limit; decodes with Pillow).
_ONE_PX_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
_ONE_PX_PNG_B64 = base64.b64encode(_ONE_PX_PNG).decode()


class _FakePix2Text:
    """Returns one equation + one text region (mirrors Pix2Text item shape)."""

    def __init__(self, latex: str = "", as_document: bool = True):
        self._latex = latex
        self._as_document = as_document

    def recognize(self, img):
        if self._as_document:
            # Pix2Text 1.1+ returns a whole-document LaTeX string with display
            # equations wrapped in $$...$$.
            if self._latex:
                return f"\n$$\n{self._latex}\n$$\n"
            return "plain text without formulas"
        if self._latex:
            return [
                {
                    "type": "equation",
                    "text": self._latex,
                    "score": 0.97,
                    "position": [[0, 0], [10, 0], [10, 10], [0, 10]],
                },
                {
                    "type": "text",
                    "text": "solvable",
                    "score": 0.9,
                    "position": [[0, 20], [20, 20], [20, 30], [0, 30]],
                },
            ]
        return [
            {
                "type": "text",
                "text": "no math here",
                "score": 0.9,
                "position": [[0, 0], [30, 0], [30, 10], [0, 10]],
            },
        ]


@pytest.fixture(autouse=True)
def _stub_engine(monkeypatch):
    import app.services.recognize as recognize

    recognize._engine = None
    monkeypatch.setattr(recognize, "_load_engine", lambda: _FakePix2Text(_LATEX_FIXTURE))
    yield
    recognize._engine = None


_LATEX_FIXTURE = "f(x) = x^2"


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["service"] == "casuya-ocr-math"


def test_readyz():
    r = client.get("/readyz")
    assert r.status_code == 200
    assert r.json()["model_loaded"] is True


def test_recognize_returns_latex():
    r = client.post("/v1/ocr/recognize", json={"image": _ONE_PX_PNG_B64})
    assert r.status_code == 200
    body = r.json()
    assert body["latex"] == _LATEX_FIXTURE
    assert body["confidence"] == 0
    assert body["symbols"] == []


def test_recognize_accepts_data_uri_prefix():
    r = client.post(
        "/v1/ocr/recognize",
        json={"image": f"data:image/png;base64,{_ONE_PX_PNG_B64}"},
    )
    assert r.status_code == 200
    assert r.json()["latex"] == _LATEX_FIXTURE


def test_recognize_rejects_invalid_base64():
    r = client.post(
        "/v1/ocr/recognize",
        json={"image": "not-valid-base64!!!" + ("A" * 32)},
    )
    assert r.status_code == 400


def test_recognize_rejects_undecodable_image():
    zeros = base64.b64encode(b"\x00" * 64).decode()
    r = client.post("/v1/ocr/recognize", json={"image": zeros})
    assert r.status_code == 400


def test_recognize_rejects_oversized_image():
    oversized = base64.b64encode(b"x" * (512 * 1024 + 1)).decode()
    r = client.post("/v1/ocr/recognize", json={"image": oversized})
    assert r.status_code == 413


def test_recognize_no_math_content(monkeypatch):
    import app.services.recognize as recognize
    from app import create_app

    monkeypatch.setattr(recognize, "_load_engine", lambda: _FakePix2Text(""))
    isolated = TestClient(create_app())
    r = isolated.post("/v1/ocr/recognize", json={"image": _ONE_PX_PNG_B64})
    assert r.status_code == 422


def test_recognize_old_list_item_shape(monkeypatch):
    import app.services.recognize as recognize
    from app import create_app

    monkeypatch.setattr(recognize, "_load_engine", lambda: _FakePix2Text(_LATEX_FIXTURE, as_document=False))
    isolated = TestClient(create_app())
    r = isolated.post("/v1/ocr/recognize", json={"image": _ONE_PX_PNG_B64})
    assert r.status_code == 200
    body = r.json()
    assert body["latex"] == _LATEX_FIXTURE
    assert body["confidence"] == pytest.approx(0.935)  # (0.97 + 0.9) / 2
    assert len(body["symbols"]) == 1
    assert body["symbols"][0]["bbox"] == {"x": 0, "y": 0, "w": 10, "h": 10}


def test_recognize_skips_non_dict_items(monkeypatch):
    import app.services.recognize as recognize
    from app import create_app

    class _MixedItemsFake:
        def recognize(self, img):
            return [
                "isolated formula region",
                {
                    "type": "equation",
                    "text": _LATEX_FIXTURE,
                    "score": 0.97,
                    "position": [[0, 0], [10, 0], [10, 10], [0, 10]],
                },
            ]

    monkeypatch.setattr(recognize, "_load_engine", lambda: _MixedItemsFake())
    isolated = TestClient(create_app())
    r = isolated.post("/v1/ocr/recognize", json={"image": _ONE_PX_PNG_B64})
    assert r.status_code == 200
    body = r.json()
    assert body["latex"] == _LATEX_FIXTURE
    assert len(body["symbols"]) == 1


def test_api_key_required_when_set(monkeypatch):
    monkeypatch.setenv("API_KEY", "secret-key")
    get_settings.cache_clear()
    r = client.post("/v1/ocr/recognize", json={"image": _ONE_PX_PNG_B64})
    assert r.status_code == 401
    r = client.post(
        "/v1/ocr/recognize",
        json={"image": _ONE_PX_PNG_B64},
        headers={"X-API-Key": "secret-key"},
    )
    assert r.status_code == 200
    get_settings.cache_clear()


def test_recognize_rate_limit(monkeypatch):
    import app.middleware.rate_limit as rate_limit
    from app import create_app

    monkeypatch.setattr(rate_limit, "ENDPOINT_LIMITS", {"/v1/ocr/recognize": 2})
    isolated = TestClient(create_app())
    payload = {"image": _ONE_PX_PNG_B64}
    assert isolated.post("/v1/ocr/recognize", json=payload).status_code == 200
    assert isolated.post("/v1/ocr/recognize", json=payload).status_code == 200
    assert isolated.post("/v1/ocr/recognize", json=payload).status_code == 429
