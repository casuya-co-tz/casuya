# Casuya Core

Core engine for compiling complete HTML lessons into secure, versioned `.pkg` packages.

## Installation

```bash
pip install -e .
```

## Usage

```python
from casuya_core.compiler import LessonCompiler
from pathlib import Path

compiler = LessonCompiler()
pkg_path = compiler.compile(Path("path/to/your/lesson.html"))
print(f"Package created: {pkg_path}")
```

## Key Features
- Full HTML lesson validation
- Minification & compression
- Dependency injection
- Digital signatures
- Schema validation
- Search-ready indexing
