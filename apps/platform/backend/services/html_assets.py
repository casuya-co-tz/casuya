"""Rewrite external CDN asset references inside pasted/uploaded HTML (games,
quizzes and lessons) so they render reliably in both local and production.

Goals
-----
1. Offline / 2G-3G first: heavy libraries (Three.js, …) are vendored on the
   platform under /static/lib and referenced with a same-origin ('self') path,
   so they work with no internet and respect the strict CSP.
2. Resilient when a vendored copy is somehow absent: we fall back to the
   original CDN URL via an ``onerror`` loader, which works wherever the page
   is rendered through ``iframe.srcdoc`` (the standard Casuya rendering path).
3. Passthrough-safe: every tag/attribute we do not recognise is preserved
   byte-for-byte, mirroring the approach used by lesson_service._MediaOptimizer.
"""

from __future__ import annotations

import html as _html
import re
from html.parser import HTMLParser

# Registry of well-known CDN libraries we vendor locally.
# Each entry: (substring_regex_on_script_src_or_css_href, local_path).
# Matching is case-insensitive. Add new vendored libraries here.
_CDN_REWRITES: list[tuple[str, str]] = [
    (
        r"cdnjs\.cloudflare\.com/ajax/libs/three\.js/r128/three\.min\.js",
        "/static/lib/three/three.min.js",
    ),
    (
        r"unpkg\.com/three@0\.128\.0/build/three\.min\.js",
        "/static/lib/three/three.min.js",
    ),
]

# Common public CDN hosts that are allowed to load referenced assets even when
# we have no vendored copy. Kept for cases rendered without a CSP (srcdoc).
_ALLOWED_CDN_HOSTS = (
    "cdnjs.cloudflare.com",
    "cdn.jsdelivr.net",
    "unpkg.com",
    "cdn.tailwindcss.com",
    "code.jquery.com",
    "cdn.plot.ly",
    "cdn.datatables.net",
)

def _find_local_path(url: str) -> str | None:
    """Return the vendored local path for a matching external URL, if any."""
    for pattern, local in _CDN_REWRITES:
        try:
            if re.search(pattern, url, re.IGNORECASE):
                return local
        except re.error:
            continue
    return None


def _js_string(value: str) -> str:
    """Escape a URL for embedding as a JS single-quoted string literal."""
    return value.replace("\\", "\\\\").replace("'", "\\u0027")


def _rewrite_script(attrs: dict[str, str]) -> dict[str, str]:
    src = attrs.get("src")
    if not src:
        return attrs
    # Attribute values are read verbatim (may contain HTML entities), so decode
    # them before URL matching and before embedding in the JS fallback. The
    # output attribute is HTML-escaped exactly once by the renderer.
    src = _html.unescape(src)
    local = _find_local_path(src)
    if not local:
        return attrs
    original = src
    attrs["src"] = local
    # Fall back to the original CDN if the vendored file is missing. Works via
    # srcdoc rendering where no CSP applies to the fallback script.
    fallback = (
        "this.onerror=null;"
        "var s=document.createElement('script');"
        f"s.src='{_js_string(original)}';"
        "document.head.appendChild(s);"
    )
    attrs["onerror"] = fallback
    return attrs


def _rewrite_link(attrs: dict[str, str]) -> dict[str, str]:
    href = attrs.get("href")
    if not href:
        return attrs
    href = _html.unescape(href)
    local = _find_local_path(href)
    if local:
        attrs["href"] = local
    return attrs


class _ExternalAssetRewriter(HTMLParser):
    """Rewrite external src/href attributes while preserving all other markup."""

    VOID = {
        "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr",
    }

    def __init__(self):
        # convert_charrefs=False: character references (&lt;, &amp;, &#39;, …)
        # are forwarded to handle_entityref/handle_charref and re-emitted
        # verbatim. Decoding them (the convert_charrefs=True default) would turn
        # "&lt;script&gt;" inside pasted text into a real "<script>" tag when the
        # browser parses the rewritten HTML.
        super().__init__(convert_charrefs=False)
        self.out: list[str] = []

    @staticmethod
    def _render(tag: str, attrs: dict[str, str], void: bool) -> str:
        parts = []
        for k, v in attrs.items():
            parts.append(k if v == "" else f'{k}="{_html.escape(v, quote=True)}"')
        rendered = f"<{tag}{(' ' + ' '.join(parts)) if parts else ''}>"
        return rendered if void else rendered + f"</{tag}>"

    def _transform(self, tag: str, attrs):
        d = {k.lower(): (v if v is not None else "") for k, v in attrs}
        if tag == "script":
            d = _rewrite_script(d)
        elif tag == "link":
            d = _rewrite_link(d)
        return d

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        d = self._transform(tag, attrs)
        if tag in self.VOID:
            self.out.append(self._render(tag, d, True))
        else:
            # starttag only; matching endtag handled separately
            parts = [k if v == "" else f'{k}="{_html.escape(v, quote=True)}"' for k, v in d.items()]
            self.out.append(f"<{tag}{(' ' + ' '.join(parts)) if parts else ''}>")

    def handle_startendtag(self, tag, attrs):
        tag = tag.lower()
        d = self._transform(tag, attrs)
        self.out.append(self._render(tag, d, True))

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


def rewrite_external_assets(html: str) -> str:
    """Rewrite known external CDN <script>/<link> to vendored local paths.

    Best-effort: if parsing fails, the original HTML is returned unchanged so
    content is never broken by this transform.
    """
    if not html:
        return html
    try:
        parser = _ExternalAssetRewriter()
        parser.feed(html)
        parser.close()
        return parser.out and "".join(parser.out) or html
    except Exception:
        return html


def cdn_hosts_for_csp() -> list[str]:
    """Return the list of CDN hosts to whitelist in the CSP as a fallback."""
    return list(_ALLOWED_CDN_HOSTS)
