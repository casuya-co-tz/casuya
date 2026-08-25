"""
Command Line Interface for Casuya Core.
"""
import argparse
from pathlib import Path

from .compiler import LessonCompiler
from .config import CompilerConfig


def main():
    parser = argparse.ArgumentParser(
        description="Casuya Core - HTML Lesson Packaging System"
    )
    parser.add_argument("html_file", type=Path, help="Path to HTML lesson file")
    parser.add_argument("-o", "--output", type=str, help="Custom output package name")
    parser.add_argument("--no-minify", action="store_true", help="Disable minification")
    parser.add_argument("--no-deps", action="store_true", help="Disable dependency injection")
    parser.add_argument("--no-validate", action="store_true", help="Skip validation")
    
    args = parser.parse_args()
    
    config = CompilerConfig(
        minify_html=not args.no_minify,
        inject_dependencies=not args.no_deps,
        validate_schema=not args.no_validate
    )
    
    compiler = LessonCompiler(config)
    pkg_path = compiler.compile(args.html_file, args.output)
    
    print(f"\nPackage ready: {pkg_path}")


if __name__ == "__main__":
    main()