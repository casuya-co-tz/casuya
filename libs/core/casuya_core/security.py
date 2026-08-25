import re
from pathlib import Path, PurePath
from typing import Dict, Any, List, Union
from .exceptions import ValidationError


class SecurityValidator:
    def validate_html_content(self, html: str) -> List[str]:
        errors = []
        dangerous_patterns = [
            (r"javascript:\s*", "Inline javascript: URI"),
            (r"onerror\s*=", "Inline onerror handler"),
            (r"onload\s*=", "Inline onload handler"),
            (r"onclick\s*=", "Inline onclick handler"),
            (r"onmouseover\s*=", "Inline onmouseover handler"),
            (r"<script[^>]*>", "Inline script tag (use dependency injection instead)"),
            (r"eval\s*\(", "eval() call"),
            (r"document\.write\s*\(", "document.write() call"),
            (r"<embed[^>]*>", "Embed tag"),
            (r"<object[^>]*>", "Object tag"),
            (r"<iframe[^>]*>", "Iframe tag"),
        ]
        for pattern, desc in dangerous_patterns:
            if re.search(pattern, html, re.IGNORECASE):
                errors.append(f"Security risk: {desc}")
        return errors

    def validate_manifest_security(self, manifest: Dict[str, Any]) -> List[str]:
        errors = []
        if not manifest.get("id"):
            errors.append("Manifest missing required 'id' field")
        if not manifest.get("version"):
            errors.append("Manifest missing version field")
        return errors

    def validate_package_paths(self, base_dir: Union[Path, str]) -> List[str]:
        base_dir = Path(base_dir)
        errors = []
        base_dir_resolved = base_dir.resolve()
        for f in base_dir.rglob("*"):
            if f.is_file():
                try:
                    f.resolve().relative_to(base_dir_resolved)
                except ValueError:
                    errors.append(f"Path traversal detected: {f}")
        return errors

    def validate_all(self, html: str, manifest: Dict[str, Any], base_dir: Union[Path, str]) -> None:
        errors = []
        errors.extend(self.validate_html_content(html))
        errors.extend(self.validate_manifest_security(manifest))
        errors.extend(self.validate_package_paths(base_dir))
        if errors:
            raise ValidationError("Security validation failed", errors=errors)
