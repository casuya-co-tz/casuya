"""
Package creation for .pkg files.
"""
from pathlib import Path
import zipfile
import shutil

from .config import CompilerConfig
from .constants import PKG_EXTENSION
from .utils import create_zip_package
from .exceptions import PackagingError
from .signatures import generate_signatures


class PackageCreator:
    """Creates final .pkg packages."""
    
    def __init__(self, config: CompilerConfig):
        self.config = config
    
    def create_package(self, build_dir: Path, package_id: str) -> Path:
        """Create final package."""
        pkg_path = self.config.output_dir / f"{package_id}{PKG_EXTENSION}"
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate signatures
        signatures = generate_signatures(build_dir)
        
        # Add signatures to build
        from .utils import save_json_file
        save_json_file(signatures, build_dir / "signatures.json")
        
        # Create zip
        try:
            create_zip_package(build_dir, pkg_path)
            print(f"Package created: {pkg_path}")
            return pkg_path
        except Exception as e:
            raise PackagingError(f"Failed to create package: {e}") from e