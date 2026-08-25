"""
Casuya Core - HTML Lesson Packaging System
"""

from .compiler import LessonCompiler
from .config import CompilerConfig
from .validator import LessonValidator
from .compressor import LessonCompressor
from .dependencies import DependencyInjector
from .versioning import Version, compare_versions, is_compatible
from .migrations import migrate_manifest, register_migration
from .signatures import generate_signatures, verify_signatures, verify_package_integrity
from .security import SecurityValidator
from .loaders import PackageLoader
from .cache import BuildCache
from .parsers import HTMLParser, CSSParser, JSParser, AssetParser
from .manifest import create_manifest, enrich_manifest_with_assets
from .metadata import create_metadata
from .packager import PackageCreator
from .cli import main as cli_main

__version__ = "0.1.0"
__all__ = [
    "LessonCompiler",
    "CompilerConfig",
    "LessonValidator",
    "LessonCompressor",
    "DependencyInjector",
    "Version",
    "compare_versions",
    "is_compatible",
    "migrate_manifest",
    "register_migration",
    "generate_signatures",
    "verify_signatures",
    "verify_package_integrity",
    "SecurityValidator",
    "PackageLoader",
    "BuildCache",
    "HTMLParser",
    "CSSParser",
    "JSParser",
    "AssetParser",
    "create_manifest",
    "enrich_manifest_with_assets",
    "create_metadata",
    "PackageCreator",
]