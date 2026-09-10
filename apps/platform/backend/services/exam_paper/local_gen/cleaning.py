"""Local question generation — HTML/text cleaning and term extraction."""

from __future__ import annotations

import re


_NOISE_PATTERNS = re.compile(
    r"(?i)\b(animated|loading|math\s*renderer|renderer|chalkboard|simulation|"
    r"dynamic\s+classroom|interactive|step-by-step|step\s+\d|/\s*\d+|"
    r"canvas|pen\s+tool|tool|click|tap|swipe|drag|scroll|"
    r"mathjax|katex|latex|tex|font\s+family|import\s+url|"
    r"rgba?\(|rgb\(|color|background|border|padding|margin|"
    r"display|flex|grid|width|height|position|overflow|"
    r"animation|transition|transform|opacity|z-index|"
    r"function|var\s|const\s|let\s|return|typeof|undefined|null|"
    r"window\.|document\.|console\.|addEventListener|querySelector|"
    r"module|exports|require|import\s|export\s|"
    r"form\s+[IVX]+\s*-\s*Mathematics|form\s+[IVX]+|"
    r"©|®|™|all\s+rights\s+reserved)\b"
)


_STOPWORDS = {
    "which", "their", "there", "about", "would", "could", "should", "because",
    "between", "through", "during", "before", "after", "above", "below",
    "other", "another", "these", "those", "first", "second", "third", "every",
    "often", "always", "never", "sometimes", "being", "having", "doing",
    "makes", "making", "called", "known", "means", "include", "includes",
    "included", "important", "different", "following", "water", "things",
    "lesson", "animated", "loading", "dynamic", "classroom", "simulation",
    "interactive", "step", "steps", "given", "proposition", "real",
    "values", "satisfy", "standard", "form", "identify", "coefficients",
    "state", "map", "find", "write", "show", "answer", "using",
    "describe", "explain", "discuss", "define", "list", "give",
    "note", "example", "examples", "two", "three", "four", "five",
    "quadratic", "equation", "formula", "coefficient", "coefficients",
    "polynomial", "discriminant", "radical", "simplification",
    "substitution", "derivation", "solution", "solutions", "equations",
    "method", "square", "completing", "standard", "comparison",
    "structural", "framework", "generic", "argument", "perfect",
    "canonical", "partition", "space", "branch", "evaluate",
    "evaluate", "evaluated", "reintroduce", "isolate", "mapped",
    "substitute", "given", "second-degree", "real", "values",
    "spinner", "subtitle", "expression", "board", "content",
    "counter", "canvas", "pen", "tool", "click", "tap",
    "swipe", "drag", "scroll", "color", "background", "border",
    "animation", "transition", "transform", "opacity", "font",
    "family", "display", "flex", "grid", "width", "height",
    "position", "overflow", "margin", "padding", "style",
    "script", "function", "return", "var", "const", "let",
    "window", "document", "console", "module", "export",
    "import", "require", "type", "class", "id", "name",
    "charset", "viewport", "content", "http", "https", "www",
    "com", "org", "net", "html", "css", "javascript",
}


def _strip_html(html: str) -> str:
    text = re.sub(r"<!DOCTYPE[^>]*>", " ", html, flags=re.IGNORECASE)
    text = re.sub(r"<head[\s\S]*?</head>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<nav[\s\S]*?</nav>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<header[\s\S]*?</header>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<footer[\s\S]*?</footer>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_terms(html: str, text: str, max_terms: int = 24) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()

    def add(raw: str) -> None:
        cleaned = re.sub(r"\s+", " ", raw).strip().strip(".,;:\"'""''")
        if len(cleaned) < 4 or len(cleaned) > 50:
            return
        if re.search(r"[\\${}=<>]", cleaned):
            return
        if re.search(r"^[a-z]+-[a-z]+$", cleaned.lower()):
            return
        key = cleaned.lower()
        if key in seen or _NOISE_PATTERNS.search(cleaned):
            return
        words = key.split()
        if all(w in _STOPWORDS for w in words):
            return
        seen.add(key)
        terms.append(cleaned)

    for pat in (r"<h[2-4][^>]*>(.*?)</h[2-4]>",):
        for m in re.finditer(pat, html, re.IGNORECASE | re.DOTALL):
            inner = re.sub(r"<[^>]+>", "", m.group(1)).strip()
            if inner and not _NOISE_PATTERNS.search(inner) and not re.search(r"[\\${}=<>]", inner):
                add(inner)
    for pat in (r"<strong[^>]*>(.*?)</strong>", r"<b[^>]*>(.*?)</b>"):
        for m in re.finditer(pat, html, re.IGNORECASE | re.DOTALL):
            inner = re.sub(r"<[^>]+>", "", m.group(1)).strip()
            if inner and not _NOISE_PATTERNS.search(inner) and not re.search(r"[\\${}=<>]", inner):
                add(inner)
    for m in re.finditer(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)", text):
        candidate = m.group(1)
        if not _NOISE_PATTERNS.search(candidate) and not re.search(r"[\\${}=<>]", candidate):
            add(candidate)
    for m in re.finditer(r'"([^"]{4,50})"', html):
        val = m.group(1)
        if (
            not _NOISE_PATTERNS.search(val)
            and not re.search(r"[\\${}=<>]", val)
            and not re.search(r"^[a-z]+-[a-z]+$", val.lower())
            and " " in val
        ):
            add(val)
    if not terms:
        for word in re.findall(r"\b[A-Za-z]{6,}\b", text):
            if word.lower() not in _STOPWORDS and not _NOISE_PATTERNS.search(word):
                add(word)
    return terms[:max_terms]


def _content_lines(html: str) -> list[str]:
    """Extract meaningful content lines from HTML, stripping tags and filtering noise."""
    text = re.sub(r"<!DOCTYPE[^>]*>", " ", html, flags=re.IGNORECASE)
    text = re.sub(r"<head[\s\S]*?</head>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<nav[\s\S]*?</nav>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<header[\s\S]*?</header>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<footer[\s\S]*?</footer>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    lines = []
    for line in text.split("\n"):
        cleaned = re.sub(r"\s+", " ", line).strip()
        if len(cleaned) >= 50 and not _NOISE_PATTERNS.search(cleaned) and not re.search(r"[\\${}]", cleaned):
            lines.append(cleaned)
    return lines


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\u201c\"'])", text)
    out: list[str] = []
    for p in parts:
        cleaned = re.sub(r"\s+", " ", p).strip()
        if 30 <= len(cleaned) <= 300 and not _NOISE_PATTERNS.search(cleaned):
            out.append(cleaned)
    return out


def _pick_salient_word(sentence: str) -> tuple[str, int] | None:
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9\-']*", sentence)
    best_w, best_i = "", -1
    for i, w in enumerate(tokens):
        base = re.sub(r"[^a-zA-Z]", "", w).lower()
        if base in _STOPWORDS or len(base) < 6:
            continue
        if len(w) > len(best_w):
            best_w, best_i = w, i
    if best_i < 0:
        return None
    return best_w, best_i