import re
from pathlib import Path
from typing import Dict, Any, List, Optional
from .constants import SUPPORTED_HTML_EXT, SUPPORTED_CSS_EXT, SUPPORTED_JS_EXT, SUPPORTED_IMAGE_EXT


class HTMLParser:
    def extract_title(self, html: str) -> Optional[str]:
        m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        return m.group(1).strip() if m else None

    def extract_meta(self, html: str) -> Dict[str, str]:
        meta = {}
        for m in re.finditer(r'<meta\s+[^>]*?(?:name|property)=["\']([^"\']+)["\'][^>]*?content=["\']([^"\']*)["\']', html, re.IGNORECASE):
            meta[m.group(1)] = m.group(2)
        return meta

    def extract_stylesheets(self, html: str) -> List[str]:
        return re.findall(r'<link[^>]*?href=["\']([^"\']+\.css[^"\']*)["\']', html, re.IGNORECASE)

    def extract_scripts(self, html: str) -> List[Dict[str, str]]:
        scripts = []
        for m in re.finditer(r'<script[^>]*?src=["\']([^"\']+)["\'][^>]*?>.*?</script>', html, re.IGNORECASE | re.DOTALL):
            scripts.append({"src": m.group(1), "type": "external"})
        for m in re.finditer(r'<script[^>]*?src=["\']([^"\']+)["\'][^>]*?/>', html, re.IGNORECASE):
            scripts.append({"src": m.group(1), "type": "external"})
        return scripts

    def extract_images(self, html: str) -> List[str]:
        return re.findall(r'<img[^>]*?src=["\']([^"\']+)["\']', html, re.IGNORECASE)

    def extract_body_content(self, html: str) -> Optional[str]:
        m = re.search(r"<body[^>]*>(.*?)</body>", html, re.IGNORECASE | re.DOTALL)
        return m.group(1).strip() if m else None

    def parse(self, html: str) -> Dict[str, Any]:
        return {
            "title": self.extract_title(html),
            "meta": self.extract_meta(html),
            "stylesheets": self.extract_stylesheets(html),
            "scripts": self.extract_scripts(html),
            "images": self.extract_images(html),
            "body_length": len(self.extract_body_content(html) or ""),
        }


class CSSParser:
    def extract_selectors(self, css: str) -> List[str]:
        selectors = []
        for m in re.finditer(r'([^{]+)\{', css):
            for s in m.group(1).split(","):
                s = s.strip()
                if s:
                    selectors.append(s)
        return selectors

    def extract_imports(self, css: str) -> List[str]:
        return re.findall(r'@import\s+["\']([^"\']+)["\']', css)

    def extract_urls(self, css: str) -> List[str]:
        return re.findall(r'url\(["\']?([^"\'\)]+)["\']?\)', css)

    def parse(self, css: str) -> Dict[str, Any]:
        return {
            "selectors": self.extract_selectors(css),
            "imports": self.extract_imports(css),
            "urls": self.extract_urls(css),
            "rule_count": len(re.findall(r'\{[^}]*\}', css)),
        }


class JSParser:
    def extract_functions(self, js: str) -> List[str]:
        return [name or alias for name, alias in re.findall(r'(?:function\s+(\w+)|(\w+)\s*=\s*function)', js)]

    def extract_imports(self, js: str) -> List[str]:
        imports = re.findall(r'(?:import|require)\s*\(?\s*["\']([^"\']+)["\']', js)
        imports += re.findall(r'from\s+["\']([^"\']+)["\']', js)
        return list(set(imports))

    def uses_eval(self, js: str) -> bool:
        return bool(re.search(r'\beval\s*\(', js))

    def uses_document_write(self, js: str) -> bool:
        return bool(re.search(r'document\.write\s*\(', js))

    def parse(self, js: str) -> Dict[str, Any]:
        return {
            "functions": self.extract_functions(js),
            "imports": self.extract_imports(js),
            "uses_eval": self.uses_eval(js),
            "uses_document_write": self.uses_document_write(js),
            "char_count": len(js),
        }


class AssetParser:
    IMAGE_EXTENSIONS = SUPPORTED_IMAGE_EXT

    def parse_image(self, path: Path) -> Dict[str, Any]:
        ext = path.suffix.lower()
        size = path.stat().st_size if path.exists() else 0
        return {
            "path": str(path),
            "format": ext.lstrip("."),
            "size_bytes": size,
        }

    def collect_assets(self, base_dir: Path) -> Dict[str, List[Dict[str, Any]]]:
        assets = {"images": [], "stylesheets": [], "scripts": [], "other": []}
        for f in base_dir.rglob("*"):
            if f.is_file():
                ext = f.suffix.lower()
                info = {"path": str(f.relative_to(base_dir)), "size_bytes": f.stat().st_size}
                if ext in SUPPORTED_IMAGE_EXT:
                    assets["images"].append(info)
                elif ext in SUPPORTED_CSS_EXT:
                    assets["stylesheets"].append(info)
                elif ext in SUPPORTED_JS_EXT:
                    assets["scripts"].append(info)
                else:
                    assets["other"].append(info)
        return assets
