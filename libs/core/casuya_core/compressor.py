"""
HTML, CSS, JS compression and minification for Casuya lessons.
"""
import re
from pathlib import Path
from typing import Optional

try:
    from htmlmin import minify as html_minify
except ImportError:
    html_minify = None

from .exceptions import CompressionError
from .config import CompilerConfig


class LessonCompressor:
    """Handles minification and compression of lesson assets."""
    
    def __init__(self, config: CompilerConfig):
        self.config = config
        self._ensure_dependencies()
    
    def _ensure_dependencies(self):
        """Warn if optional minifiers are missing."""
        if not html_minify:
            print("htmlmin not installed. Using basic minification.")
    
    def minify_html(self, html_content: str) -> str:
        """Minify HTML content."""
        if not self.config.minify_html:
            return html_content
        
        try:
            if html_minify:
                # htmlmin parameters
                return html_minify(
                    html_content,
                    remove_empty_space=True,
                    remove_comments=True,
                    remove_optional_attribute_quotes=True
                )
            else:
                # Basic fallback minification that protects content-sensitive regions
                return self._minify_html_basic(html_content)
        except Exception as e:
            raise CompressionError(f"HTML minification failed: {e}") from e
    
    def minify_css(self, css_content: str) -> str:
        """CSS minification that preserves the contents of string literals."""
        if not self.config.minify_css:
            return css_content
        return self._minify_css(css_content)

    def minify_js(self, js_content: str) -> str:
        """JS minification that preserves string/regex literal contents."""
        if not self.config.minify_js:
            return js_content
        return self._minify_js(js_content)

    @staticmethod
    def _minify_css(css_content: str) -> str:
        out: list[str] = []
        i = 0
        n = len(css_content)
        while i < n:
            c = css_content[i]
            nxt = css_content[i + 1] if i + 1 < n else ""
            if c == '"' or c == "'":
                out.append(c)
                i += 1
                while i < n:
                    sc = css_content[i]
                    out.append(sc)
                    if sc == "\\" and i + 1 < n:
                        out.append(css_content[i + 1])
                        i += 2
                        continue
                    if sc == c:
                        i += 1
                        break
                    i += 1
                continue
            if c == "/" and nxt == "*":
                i += 2
                while i < n and not (css_content[i] == "*" and css_content[i + 1 : i + 2] == "/"):
                    i += 1
                i += 2
                continue
            if c.isspace():
                if out and not out[-1].isspace():
                    out.append(" ")
            else:
                out.append(c)
            i += 1
        return "".join(out).strip()

    @staticmethod
    def _is_regex_start(out: list) -> bool:
        j = len(out) - 1
        while j >= 0 and out[j].isspace():
            j -= 1
        if j < 0:
            return True
        return out[j] in "=(:,[!&|?{};+-*%^~<>"

    def _minify_js(self, js_content: str) -> str:
        out: list[str] = []
        i = 0
        n = len(js_content)
        while i < n:
            c = js_content[i]
            nxt = js_content[i + 1] if i + 1 < n else ""
            if c == '"' or c == "'" or c == "`":
                out.append(c)
                i += 1
                while i < n:
                    sc = js_content[i]
                    out.append(sc)
                    if sc == "\\" and i + 1 < n:
                        out.append(js_content[i + 1])
                        i += 2
                        continue
                    if sc == c:
                        i += 1
                        break
                    i += 1
                continue
            if c == "/" and nxt == "/":
                i += 2
                while i < n and js_content[i] != "\n":
                    i += 1
                continue
            if c == "/" and nxt == "*":
                i += 2
                while i < n and not (js_content[i] == "*" and js_content[i + 1 : i + 2] == "/"):
                    i += 1
                i += 2
                continue
            if c == "/" and self._is_regex_start(out):
                out.append(c)
                i += 1
                while i < n:
                    rc = js_content[i]
                    out.append(rc)
                    if rc == "\\" and i + 1 < n:
                        out.append(js_content[i + 1])
                        i += 2
                        continue
                    if rc == "/":
                        i += 1
                        while i < n and js_content[i].isalpha():
                            out.append(js_content[i])
                            i += 1
                        break
                    i += 1
                continue
            if c.isspace():
                if out and not out[-1].isspace():
                    out.append(" ")
            else:
                out.append(c)
            i += 1
        return "".join(out).strip()

    @staticmethod
    def _minify_html_basic(html_content: str) -> str:
        parts = re.split(r"(<(?:script|style|pre)\b.*?</(?:script|style|pre)>|<(?:script|style|pre)\b[^>]*>.*?</(?:script|style|pre)>)", html_content, flags=re.IGNORECASE | re.DOTALL)
        out: list[str] = []
        for part in parts:
            if re.match(r"<(?:script|style|pre)\b", part, flags=re.IGNORECASE):
                out.append(part)
            else:
                collapsed = re.sub(r"<!--.*?-->", "", part, flags=re.DOTALL)
                collapsed = re.sub(r"\s+", " ", collapsed)
                out.append(collapsed)
        return "".join(out).strip()

    
    def process_lesson(self, build_dir: Path) -> None:
        """Process all files in the build directory."""
        for html_file in build_dir.rglob("*.html"):
            with open(html_file, "r", encoding="utf-8") as f:
                content = f.read()
            minified = self.minify_html(content)
            with open(html_file, "w", encoding="utf-8") as f:
                f.write(minified)
        
        print("Compression completed")