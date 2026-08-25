"""
Casuya Core Constants
Centralized constants for the lesson packaging system.
"""

import os
from pathlib import Path

# Package format
PKG_EXTENSION = ".pkg"
PKG_MAGIC = b"CASUYA_PKG"
PKG_VERSION = "1.0.0"

# File names
MANIFEST_FILENAME = "manifest.json"
METADATA_FILENAME = "metadata.json"
INDEX_FILENAME = "index.json"
SIGNATURE_FILENAME = "signatures.json"

# Directories inside package
CONTENT_DIR = "content"
ASSETS_DIR = "assets"
SCRIPTS_DIR = "scripts"

# Limits
MAX_LESSON_SIZE_MB = 50
MAX_ASSET_SIZE_MB = 10
MAX_MANIFEST_SIZE_KB = 64

# Supported mime types / file extensions
SUPPORTED_HTML_EXT = {".html", ".htm"}
SUPPORTED_CSS_EXT = {".css"}
SUPPORTED_JS_EXT = {".js"}
SUPPORTED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}

# Default values
DEFAULT_VERSION = "1.0.0"
DEFAULT_DIFFICULTY = "Medium"
DEFAULT_LANGUAGE = "en"

# Paths
ROOT_DIR = Path(__file__).parent.parent
TEMPLATES_DIR = ROOT_DIR / "templates"
SCHEMAS_DIR = ROOT_DIR / "schemas"

# Runtime dependencies
RUNTIME_JS = "casuya-runtime.js"
BRIDGE_JS = "casuya-bridge.js"