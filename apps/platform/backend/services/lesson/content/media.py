"""Lesson service — media optimization for low-bandwidth (2G/3G) delivery."""

from __future__ import annotations

import html
from html.parser import HTMLParser


class _MediaOptimizer(HTMLParser):
    """Add bandwidth-friendly attributes to <img>/<video> in lesson HTML.

    - <img>: lazy-load + async decode + never overflow the viewport.
      WebP/AVIF <picture> variants are generated on upload (see uploads.py)
      and served by the CDN — no need to wrap here.
    - <video>: do NOT preload (avoids 50 MB auto-downloads on 3G), allow inline
      playback, always show controls. Adaptive HLS/DASH transcoding is a separate
      backend pipeline (see PERFORMANCE_OPTIMIZATION_PLAN.md P1-5); this at least
      stops the browser from pulling the whole file before the user hits play.
    """

    VOID = {"img", "br", "hr", "input", "meta", "link", "source", "area", "base", "col", "embed", "param", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []

    @staticmethod
    def _render(tag: str, attrs: dict[str, str], void: bool) -> str:
        parts = []
        for k, v in attrs.items():
            parts.append(k if v == "" else f'{k}="{html.escape(v, quote=True)}"')
        rendered = f"<{tag}{(' ' + ' '.join(parts)) if parts else ''}>"
        return rendered

    def _img_attrs(self, attrs):
        d = {k.lower(): (v if v is not None else "") for k, v in attrs}
        d.setdefault("loading", "lazy")
        d.setdefault("decoding", "async")
        d.setdefault("referrerpolicy", "no-referrer")
        style = d.get("style", "")
        if "max-width" not in style:
            d["style"] = (style + ";max-width:100%;height:auto").strip(";")
        return d

    def _video_attrs(self, attrs):
        d = {k.lower(): (v if v is not None else "") for k, v in attrs}
        d.setdefault("preload", "none")
        d.setdefault("playsinline", "")
        d.setdefault("controls", "")
        style = d.get("style", "")
        if "max-width" not in style:
            d["style"] = (style + ";max-width:100%").strip(";")
        return d

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "img":
            self.out.append(self._render("img", self._img_attrs(attrs), True))
        elif tag == "video":
            self.out.append(self._render("video", self._video_attrs(attrs), False))
        else:
            self.out.append(self._render(tag, {k.lower(): (v if v is not None else "") for k, v in attrs}, tag in self.VOID))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag.lower() not in self.VOID:
            self.out.append(f"</{tag.lower()}>")

    def handle_endtag(self, tag):
        self.out.append(f"</{tag.lower()}>")

    def handle_data(self, data):
        self.out.append(data)

    def handle_comment(self, data):
        self.out.append(f"<!--{data}-->")

    def handle_decl(self, data):
        self.out.append(f"<!{data}>")

    def handle_pi(self, data):
        self.out.append(f"<?{data}?>")

    def handle_entityref(self, name):
        self.out.append(f"&{name};")

    def handle_charref(self, name):
        self.out.append(f"&#{name};")


def optimize_media(html: str) -> str:
    """Make images/video in served lesson HTML cheap to load on slow networks."""
    try:
        parser = _MediaOptimizer()
        parser.feed(html)
        return parser.out and "".join(parser.out) or html
    except Exception:
        return html  # best-effort; never break lesson rendering