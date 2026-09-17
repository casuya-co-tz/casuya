"""OCR fixture validation for the platform Mathpix proxy (B-04 optional)."""

from __future__ import annotations

import base64
from unittest.mock import patch

import pytest

from backend.services.ocr_service import decode_image_payload, recognize_self_hosted

# Mirrors packages/blackboard/tests/evaluation/fixtures/handwriting-samples.ts
FIXTURE_BLANK_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
FIXTURE_STROKE_PNG = (
    "iVBORw0KGgoAAAANSUhEUgAAADAAAAAYCAYAAAAf8/7HAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/"
    "AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNui8sowAAAAWdEVYdENyZWF0aW9uIFRpbWUAMDgvMDEvMDj8K8QAAAAQ"
    "SURBVEiNY2AYBaNgFIyCUTDqAwAbXgH5Kp8H5QAAAABJRU5ErkJggg=="
)


@pytest.mark.parametrize(
    "payload",
    [FIXTURE_BLANK_PNG, FIXTURE_STROKE_PNG, f"data:image/png;base64,{FIXTURE_BLANK_PNG}"],
)
def test_fixture_payloads_decode(payload: str):
    raw = decode_image_payload(payload)
    assert len(raw) > 0
    assert raw[:4] == b"\x89PNG"


def test_fixture_sizes_under_platform_limit():
    for fixture in (FIXTURE_BLANK_PNG, FIXTURE_STROKE_PNG):
        assert len(base64.b64decode(fixture)) < 512 * 1024


def test_recognize_self_hosted_sends_internal_request():
    expected_body = {
        "latex": "x = 5",
        "confidence": 0.91,
        "symbols": [],
    }
    captured = {}

    class _FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def post(self, url, headers, json):
            captured["url"] = url
            captured["headers"] = headers
            captured["json"] = json

            class _Resp:
                status_code = 200

                def json(self):
                    return expected_body

            return _Resp()

    with patch("backend.services.ocr_service.httpx.Client", new=_FakeClient) as fake_cls:
        result = recognize_self_hosted(FIXTURE_BLANK_PNG, "http://ocr-math:8030", "secret")

    assert result == expected_body
    assert captured["url"] == "http://ocr-math:8030/v1/ocr/recognize"
    assert captured["headers"]["X-API-Key"] == "secret"
    assert captured["json"] == {"image": FIXTURE_BLANK_PNG}


def test_recognize_self_hosted_strips_data_uri_prefix():
    captured = {}

    class _FakeClient:
        def __init__(self, timeout):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def post(self, _url, headers, json):
            captured["image"] = json["image"]
            captured["headers"] = headers

            class _Resp:
                status_code = 200

                def json(self):
                    return {"latex": "", "confidence": 0, "symbols": []}

            return _Resp()

    with patch("backend.services.ocr_service.httpx.Client", new=_FakeClient):
        recognize_self_hosted(f"data:image/png;base64,{FIXTURE_BLANK_PNG}", "http://ocr-math:8030", None)

    assert captured["image"] == FIXTURE_BLANK_PNG
    assert "X-API-Key" not in captured["headers"]
