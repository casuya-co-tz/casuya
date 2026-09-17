"""OCR fixture validation for the platform Mathpix proxy (B-04 optional)."""

from __future__ import annotations

import base64

import pytest

from backend.services.ocr_service import decode_image_payload

# Mirrors packages/blackboard/tests/evaluation/fixtures/handwriting-samples.ts
FIXTURE_BLANK_PNG = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
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
