import shutil
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional
from .config import DEFAULT_CONFIG, CompilerConfig
from .validator import LessonValidator
from .dependencies import DependencyInjector
from .exceptions import CompilationError
from .utils import setup_logging
from .manifest import create_manifest, enrich_manifest_with_assets
from .metadata import create_metadata
from .security import SecurityValidator
from .cache import BuildCache
from .parsers import AssetParser


class LessonCompiler:
    def __init__(self, config: Optional[CompilerConfig] = None):
        self.config = config or DEFAULT_CONFIG
        self.validator = LessonValidator()
        self.security = SecurityValidator()
        self.cache = BuildCache() if self.config.enable_cache else None
        setup_logging()

    def compile(self, html_path: Path, output_name: Optional[str] = None) -> Path:
        try:
            print(f"Starting compilation of {html_path.name}")
            metadata = create_metadata(html_path)
            manifest = create_manifest(html_path, metadata)
            if self.config.validate_schema:
                self.validator.validate_lesson(html_path, manifest, metadata)
            if self.config.enable_security_validation:
                html = html_path.read_text("utf-8")
                self.security.validate_all(html, manifest, html_path.parent)
            build_dir = Path(tempfile.gettempdir()) / "casuya_build" / manifest["id"]
            build_dir.mkdir(parents=True, exist_ok=True)
            content_dir = build_dir / "content"
            content_dir.mkdir(exist_ok=True)
            shutil.copy2(html_path, content_dir / "index.html")
            from .utils import save_json_file
            save_json_file(manifest, build_dir / "manifest.json")
            save_json_file(metadata, build_dir / "metadata.json")
            injector = DependencyInjector(self.config)
            injector.inject(build_dir)
            manifest = enrich_manifest_with_assets(manifest, build_dir)
            save_json_file(manifest, build_dir / "manifest.json")
            from .compressor import LessonCompressor
            compressor = LessonCompressor(self.config)
            compressor.process_lesson(build_dir)
            from .packager import PackageCreator
            packager = PackageCreator(self.config)
            pkg_path = packager.create_package(build_dir, output_name or manifest["id"])
            print(f"Compilation completed: {pkg_path.name}")
            return pkg_path
        except Exception as e:
            raise CompilationError(f"Compilation failed for {html_path}: {e}") from e
