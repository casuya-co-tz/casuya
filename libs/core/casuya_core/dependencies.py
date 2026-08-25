"""
Dependency injection for runtime scripts and tracking.
"""
from pathlib import Path
from typing import List

from .config import CompilerConfig


class DependencyInjector:
    """Injects runtime JS, analytics, etc. into lessons."""
    
    def __init__(self, config: CompilerConfig):
        self.config = config
    
    def inject(self, build_dir: Path):
        """Inject dependencies into HTML files."""
        if not self.config.inject_dependencies:
            return
        
        for html_file in build_dir.rglob("*.html"):
            with open(html_file, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Inject runtime scripts before </body>
            scripts = [
                '<script src="/casuya-runtime.js"></script>',
                '<script src="/casuya-bridge.js"></script>'
            ]
            
            if "</body>" in content:
                injected = content.replace("</body>", "\n".join(scripts) + "\n</body>")
            else:
                injected = content + "\n".join(scripts)
            
            with open(html_file, "w", encoding="utf-8") as f:
                f.write(injected)
        
        print("Dependencies injected")