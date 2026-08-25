import json
from pathlib import Path
from typing import Dict, Any, List, Optional
import jsonschema
from .constants import SCHEMAS_DIR, MANIFEST_FILENAME
from .exceptions import ValidationError
from .security import SecurityValidator


class LessonValidator:
    def __init__(self):
        self.schemas = self._load_schemas()
        self.security = SecurityValidator()

    def _load_schemas(self) -> Dict[str, Dict]:
        schemas = {}
        for schema_file in ["lesson.schema.json", "manifest.schema.json", "metadata.schema.json"]:
            path = SCHEMAS_DIR / schema_file
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    schemas[schema_file] = json.load(f)
        return schemas

    def validate_manifest(self, manifest: Dict[str, Any]) -> None:
        schema = self.schemas.get("manifest.schema.json")
        if schema:
            try:
                jsonschema.validate(instance=manifest, schema=schema)
            except jsonschema.exceptions.ValidationError as e:
                raise ValidationError(f"Manifest validation failed: {e.message}") from e

    def validate_metadata(self, metadata: Dict[str, Any]) -> None:
        schema = self.schemas.get("metadata.schema.json")
        if schema:
            try:
                jsonschema.validate(instance=metadata, schema=schema)
            except jsonschema.exceptions.ValidationError as e:
                raise ValidationError(f"Metadata validation failed: {e.message}") from e

    def validate_html(self, html_content: str) -> List[str]:
        errors = []
        if not html_content or len(html_content.strip()) < 50:
            errors.append("HTML content too short or empty")
        if "<html" not in html_content.lower() and "<!doctype" not in html_content.lower():
            errors.append("Missing HTML document structure")
        return errors

    def validate_lesson(self, html_path: Path, manifest: Dict, metadata: Dict) -> None:
        errors = []
        if not html_path.exists():
            errors.append(f"HTML file not found: {html_path}")
            return errors
        with open(html_path, "r", encoding="utf-8") as f:
            html = f.read()
            html_errors = self.validate_html(html)
            errors.extend(html_errors)
            html_errors = self.security.validate_html_content(html)
            errors.extend(html_errors)
        try:
            self.validate_manifest(manifest)
            self.validate_metadata(metadata)
        except ValidationError as e:
            errors.append(str(e))
        sec_errors = self.security.validate_manifest_security(manifest)
        errors.extend(sec_errors)
        if errors:
            raise ValidationError("Lesson validation failed", errors=errors)
        print(f"Lesson validated successfully: {manifest.get('title', 'Untitled')}")
