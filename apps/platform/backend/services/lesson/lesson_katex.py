"""Lesson content — LaTeX detection and self-hosted KaTeX injection."""

from __future__ import annotations

import re

_LATEX_PATTERNS: list[re.Pattern[str]] | None = None


def _compile_latex_patterns():
    global _LATEX_PATTERNS
    if _LATEX_PATTERNS is not None:
        return
    _LATEX_PATTERNS = [
        re.compile(r"\$\$[^$]+\$\$"),
        re.compile(r"\$[^$\n]+\$"),
        re.compile(r"\\\[[^\\]+\\\]"),
        re.compile(r"\\\([^\\]+\\\)"),
    ]


def _has_latex(html: str) -> bool:
    _compile_latex_patterns()
    if _LATEX_PATTERNS is None:
        return False
    return any(p.search(html) for p in _LATEX_PATTERNS)


def _has_mathjax(html: str) -> bool:
    return any(marker in html for marker in ["mathjax", "MathJax", "tex-mml-chtml", "cdn.jsdelivr.net/npm/mathjax"])


def _clean_mathjax_broken_katex(html: str) -> str:
    html = re.sub(r"<link[^>]*katex[^>]*>", "", html)
    html = re.sub(r"<script[^>]*katex[^>]*>.*?</script>", "", html, flags=re.DOTALL)
    return html


def _strip_mathjax(html: str) -> str:
    """Remove MathJax CDN <script> tags and inline MathJax config/startup blocks.

    The platform self-hosts KaTeX (served from /static/lib/katex) and keeps a
    strict CSP (script-src 'self'), so the external MathJax CDN is both blocked
    and contrary to the offline-first goal. This strips MathJax references so the
    self-hosted KaTeX bundle can be injected instead without a dead MathJax
    leftover throwing ReferenceError: MathJax is not defined.
    """
    html = re.sub(
        r"<script\b[^>]*\bsrc\s*=\s*[\"'][^\"']*cdn\.jsdelivr\.net[^\"']*mathjax[^\"']*[\"'][^>]*>\s*</script>",
        "",
        html,
        flags=re.IGNORECASE,
    )
    html = re.sub(
        r"<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?MathJax[\s\S]*?</script>",
        "",
        html,
        flags=re.IGNORECASE,
    )
    return html


def _optimize_math_injection(html: str) -> str:
    if not _has_latex(html):
        return html

    if _has_mathjax(html):
        html = _strip_mathjax(html)
        html = _clean_mathjax_broken_katex(html)

    katex_css = '<link rel="stylesheet" href="/static/lib/katex/katex.min.css" crossorigin="anonymous">'
    katex_js = '<script src="/static/lib/katex/katex.min.js" crossorigin="anonymous"></script>'
    auto_render_js = '<script src="/static/lib/katex/contrib/auto-render.min.js" crossorigin="anonymous"></script>'
    render_call = (
        "<script>"
        'document.addEventListener("DOMContentLoaded",function(){'
        'if(typeof renderMathInElement==="function"){'
        "renderMathInElement(document.body,{delimiters:["
        '{left:"$$",right:"$$",display:true},'
        '{left:"$",right:"$",display:false},'
        '{left:"\\\\[",right:"\\\\]",display:true},'
        '{left:"\\\\(",right:"\\\\)",display:false}'
        "]});"
        "}"
        "});"
        "</script>"
    )

    has_head = "<head>" in html.lower()
    has_body_close = "</body>" in html.lower()
    has_doctype = html.strip().upper().startswith("<!DOCTYPE")

    if not has_head and not has_body_close and not has_doctype:
        html = (
            "<!DOCTYPE html><html><head>"
            "<meta charset='UTF-8'>"
            "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
            + katex_css
            + "</head><body>"
            + html
            + katex_js
            + auto_render_js
            + render_call
            + "</body></html>"
        )
        return html

    html = html.replace("<head>", "<head>" + katex_css, 1) if has_head else katex_css + html

    katex_scripts = katex_js + auto_render_js + render_call

    if has_body_close:
        html = html.replace("</body>", katex_scripts + "</body>", 1)
    else:
        html += katex_scripts

    return html


def _inject_katex(html: str) -> str:
    return _optimize_math_injection(html)