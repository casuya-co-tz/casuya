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
                # Basic fallback minification
                html = re.sub(r'\s+', ' ', html_content)
                html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
                return html.strip()
        except Exception as e:
            raise CompressionError(f"HTML minification failed: {e}") from e
    
    def minify_css(self, css_content: str) -> str:
        """Basic CSS minification."""
        if not self.config.minify_css:
            return css_content
        # Remove comments and whitespace
        css = re.sub(r'/\*.*?\*/', '', css_content, flags=re.DOTALL)
        css = re.sub(r'\s+', ' ', css)
        return css.strip()
    
    def minify_js(self, js_content: str) -> str:
        """Basic JS minification (placeholder for full terser later)."""
        if not self.config.minify_js:
            return js_content
        # Very basic - remove comments and extra whitespace
        js = re.sub(r'//.*?$|/\*.*?\*/', '', js_content, flags=re.MULTILINE | re.DOTALL)
        js = re.sub(r'\s+', ' ', js)
        return js.strip()
    
    def process_lesson(self, build_dir: Path) -> None:
        """Process all files in the build directory."""
        for html_file in build_dir.rglob("*.html"):
            with open(html_file, "r", encoding="utf-8") as f:
                content = f.read()
            minified = self.minify_html(content)
            with open(html_file, "w", encoding="utf-8") as f:
                f.write(minified)
        
        print("Compression completed")