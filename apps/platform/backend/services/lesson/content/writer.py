"""Write precompressed lesson HTML sidecars so content can stream without buffering."""

from __future__ import annotations

import gzip

from .paths import get_gzip_path


def write_content_gzip(slug: str, html: str) -> None:
    if not slug or not html:
        return
    try:
        path = get_gzip_path(slug)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(gzip.compress(html.encode("utf-8"), compresslevel=9))
    except Exception:
        pass
