"""
Configuration management for Casuya Core.
"""
from dataclasses import dataclass
from typing import Optional, Dict, Any
import json
from pathlib import Path

from .constants import DEFAULT_VERSION, DEFAULT_DIFFICULTY, DEFAULT_LANGUAGE


@dataclass
class CompilerConfig:
    """Configuration for the lesson compiler."""
    minify_html: bool = True
    minify_css: bool = True
    minify_js: bool = True
    compress_package: bool = True
    inject_dependencies: bool = True
    validate_schema: bool = True
    generate_signatures: bool = True
    include_source_maps: bool = False
    enable_security_validation: bool = True
    enable_cache: bool = True
    enable_version_management: bool = True
    
    # Output settings
    output_dir: Path = Path("packages")
    
    # Metadata defaults
    default_version: str = DEFAULT_VERSION
    default_difficulty: str = DEFAULT_DIFFICULTY
    default_language: str = DEFAULT_LANGUAGE
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CompilerConfig":
        """Create config from dictionary."""
        output_dir = Path(data.get("output_dir", "packages"))
        return cls(
            minify_html=data.get("minify_html", True),
            minify_css=data.get("minify_css", True),
            minify_js=data.get("minify_js", True),
            compress_package=data.get("compress_package", True),
            inject_dependencies=data.get("inject_dependencies", True),
            validate_schema=data.get("validate_schema", True),
            generate_signatures=data.get("generate_signatures", True),
            include_source_maps=data.get("include_source_maps", False),
            enable_security_validation=data.get("enable_security_validation", True),
            enable_cache=data.get("enable_cache", True),
            enable_version_management=data.get("enable_version_management", True),
            output_dir=output_dir,
            default_version=data.get("default_version", DEFAULT_VERSION),
            default_difficulty=data.get("default_difficulty", DEFAULT_DIFFICULTY),
            default_language=data.get("default_language", DEFAULT_LANGUAGE),
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "minify_html": self.minify_html,
            "minify_css": self.minify_css,
            "minify_js": self.minify_js,
            "compress_package": self.compress_package,
            "inject_dependencies": self.inject_dependencies,
            "validate_schema": self.validate_schema,
            "generate_signatures": self.generate_signatures,
            "include_source_maps": self.include_source_maps,
            "enable_security_validation": self.enable_security_validation,
            "enable_cache": self.enable_cache,
            "enable_version_management": self.enable_version_management,
            "output_dir": str(self.output_dir),
            "default_version": self.default_version,
            "default_difficulty": self.default_difficulty,
            "default_language": self.default_language,
        }


# Global default config
DEFAULT_CONFIG = CompilerConfig()