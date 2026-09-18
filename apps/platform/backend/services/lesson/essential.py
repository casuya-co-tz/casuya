"""Strip heavy media from lesson HTML for 2G / essential package downloads."""

from __future__ import annotations

import re

_VIDEO_BLOCK = re.compile(r"<video\b[^>]*>.*?</video>", re.IGNORECASE | re.DOTALL)
_AUDIO_BLOCK = re.compile(r"<audio\b[^>]*>.*?</audio>", re.IGNORECASE | re.DOTALL)
_IFRAME_MEDIA = re.compile(
    r"<iframe\b[^>]*(?:youtube|youtu\.be|vimeo|player\.vimeo)[^>]*>.*?</iframe>",
    re.IGNORECASE | re.DOTALL,
)

_PLACEHOLDER = (
    '<p class="casuya-essential-media" data-casuya-stripped="video">'
    "Video omitted on a slow connection. Open this lesson on Wi-Fi to play it."
    "</p>"
)


def strip_essential_html(html: str) -> str:
    """Remove video/audio/YouTube embeds so a 2G download stays small."""
    if not html:
        return html
    out = _VIDEO_BLOCK.sub(_PLACEHOLDER, html)
    out = _AUDIO_BLOCK.sub("", out)
    out = _IFRAME_MEDIA.sub(_PLACEHOLDER, out)
    return out
