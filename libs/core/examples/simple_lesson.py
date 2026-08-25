"""
Example usage of Casuya Core.
"""
from pathlib import Path
from casuya_core.compiler import LessonCompiler


def main():
    compiler = LessonCompiler()
    
    # Example: compile a sample HTML lesson
    sample_html = Path("examples/sample.html")
    
    # For demo purposes - create a minimal HTML if not exists
    if not sample_html.exists():
        sample_html.parent.mkdir(exist_ok=True)
        with open(sample_html, "w", encoding="utf-8") as f:
            f.write("""<!DOCTYPE html>
<html>
<head><title>Sample Lesson</title></head>
<body>
    <h1>Hello, Casuya!</h1>
    <p>This is a sample interactive lesson.</p>
</body>
</html>""")
    
    pkg_path = compiler.compile(sample_html)
    print(f"Success! Package at: {pkg_path}")


if __name__ == "__main__":
    main()