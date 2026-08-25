import re
from backend.config.security import create_access_token
from backend.config.database import get_db
from backend.models.user import User
from backend.models.lesson import Lesson

db = next(get_db())
user = db.query(User).filter(User.role == 'admin').first()
token = create_access_token(user.id, {'role': user.role})

import requests

def test_lesson(id, slug):
    resp = requests.get(
        f'http://localhost:8765/lessons/{id}/content',
        headers={'Authorization': f'Bearer {token}'}
    )
    c = resp.text
    
    print(f"\n===== {slug} =====")
    print(f"Status: {resp.status_code}")
    
    has_mathjax = any(marker in c for marker in ["mathjax", "MathJax", "tex-mml-chtml", "cdn.jsdelivr.net/npm/mathjax"])
    has_katex_css = c.count('/static/lib/katex/katex.min.css')
    has_katex_js = c.count('/static/lib/katex/katex.min.js')
    has_autorender = c.count('/static/lib/katex/contrib/auto-render.min.js')
    
    print(f"MathJax markers: {has_mathjax}")
    print(f"KaTeX CSS: {has_katex_css}")
    print(f"KaTeX JS: {has_katex_js}")
    print(f"Auto-render: {has_autorender}")
    
    if has_mathjax and has_katex_css:
        print("❌ BROKEN: Both MathJax AND KaTeX (combined rendering)")
        return False
    elif has_mathjax and not has_katex_css:
        print("✅ CLEAN: MathJax only (working)")
        return True
    elif has_katex_css and not has_mathjax:
        print("✅ CLEAN: KaTeX only (working)")
        return True
    elif not has_mathjax and not has_katex_css:
        print("⚠️  EMPTY: No math rendering (needs math)")
        return None
    else:
        print("❓ UNKNOWN: Confusing state")
        return False

# Test both quadratic formula lessons
legacy_lesson = db.query(Lesson).filter(Lesson.id == 'c4d11a72-0da3-4f71-8af9-a20b3b4666c3').first()
broken_lesson = db.query(Lesson).filter(Lesson.id == '25fa575c-05bf-4f5e-844e-371f8e8e21cd').first()

test_lesson(legacy_lesson.id, legacy_lesson.slug)
test_lesson(broken_lesson.id, broken_lesson.slug)
