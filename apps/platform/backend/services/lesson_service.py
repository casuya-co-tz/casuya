import functools
import hashlib
import html
import json
import re
import time
import uuid
from html.parser import HTMLParser
from pathlib import Path

from sqlalchemy.orm import Session

from backend.config.database import get_db, get_engine
from backend.config.settings import get_settings
from backend.middleware.cache import cache_get as redis_cache_get
from backend.middleware.cache import cache_invalidate
from backend.middleware.cache import cache_set as redis_cache_set
from backend.models.lesson import Lesson
from backend.models.lesson_version import LessonVersion

settings = get_settings()

# ── Content cache (Redis-backed, survives restarts & shared across workers) ──
# Long TTL: the KaTeX-injected HTML is expensive to rebuild, but it only changes
# when the lesson is edited — and edit/publish/delete already invalidate this cache
# (see _cache_invalidate_content / cache_invalidate("lessons:")). So we cache for a
# day, which means the per-request injection runs at most once per content change.
CONTENT_CACHE_TTL = 86400  # 24 hours


def _cache_get(key: str) -> str | None:
    """Read from Redis cache. Returns str or None."""
    return redis_cache_get(f"lesson:content:{key}", ttl_seconds=CONTENT_CACHE_TTL)


def _cache_set(key: str, value: str):
    """Write to Redis cache with TTL."""
    redis_cache_set(f"lesson:content:{key}", value, ttl=CONTENT_CACHE_TTL)


def _cache_invalidate_content(slug: str):
    """Invalidate a specific lesson content cache entry."""
    try:
        from backend.config.database import redis_client

        redis_client.delete(f"cache:lesson:content:{slug}")
    except Exception:
        pass


# ── Sharded package paths ──
def get_package_path(slug: str) -> Path:
    storage = Path(settings.storage_root) / "lesson-packages"
    if len(slug) < 4:
        return storage / f"{slug}.html"
    return storage / slug[:2] / slug[2:4] / f"{slug}.html"


def _migrate_old_package(slug: str) -> str | None:
    """Migrate old flat JSON or filesystem package to DB, return HTML content."""
    new_path = get_package_path(slug)
    if new_path.exists():
        try:
            html = new_path.read_text(encoding="utf-8")
            _backfill_content_to_db(slug, html)
            return html
        except Exception:
            pass

    old_path = Path(settings.storage_root) / "lesson-packages" / f"{slug}.json"
    if not old_path.exists():
        return None
    try:
        pkg = json.loads(old_path.read_text(encoding="utf-8"))
        html = pkg.get("html", "")
        new_path = get_package_path(slug)
        new_path.parent.mkdir(parents=True, exist_ok=True)
        new_path.write_text(html, encoding="utf-8")
        old_path.unlink()  # remove old format after migration
        _backfill_content_to_db(slug, html)
        return html
    except Exception:
        return None


def _backfill_content_to_db(slug: str, html: str) -> None:
    """Write filesystem content into the DB lesson row so future reads are DB-only."""
    try:
        _gen = get_db()
        db: Session = next(_gen)
        try:
            lesson = db.query(Lesson).filter(Lesson.slug == slug).first()
            if lesson and not lesson.content:
                lesson.content = html
                db.commit()
        finally:
            _gen.close()
    except Exception:
        pass  # best-effort; filesystem fallback remains


# ── LaTeX detection & KaTeX injection ──
_LATEX_PATTERNS: list[re.Pattern[str]] | None = None


def _compile_latex_patterns():
    global _LATEX_PATTERNS
    if _LATEX_PATTERNS is not None:
        return
    _LATEX_PATTERNS = [
        re.compile(r"\$\$[^$]+\$\$"),
        re.compile(r"\$[^$\n]+\$"),
        re.compile(r"\\\[[^\\]+\\\]"),
        re.compile(r"\\\([^\\]+\\\)"),
    ]


def _has_latex(html: str) -> bool:
    _compile_latex_patterns()
    if _LATEX_PATTERNS is None:
        return False
    return any(p.search(html) for p in _LATEX_PATTERNS)


def _has_mathjax(html: str) -> bool:
    return any(marker in html for marker in ["mathjax", "MathJax", "tex-mml-chtml", "cdn.jsdelivr.net/npm/mathjax"])


def _clean_mathjax_broken_katex(html: str) -> str:
    html = re.sub(r"<link[^>]*katex[^>]*>", "", html)
    html = re.sub(r"<script[^>]*katex[^>]*>.*?</script>", "", html, flags=re.DOTALL)
    return html


def _strip_mathjax(html: str) -> str:
    """Remove MathJax CDN <script> tags and inline MathJax config/startup blocks.

    The platform self-hosts KaTeX (served from /static/lib/katex) and keeps a
    strict CSP (script-src 'self'), so the external MathJax CDN is both blocked
    and contrary to the offline-first goal. This strips MathJax references so the
    self-hosted KaTeX bundle can be injected instead without a dead MathJax
    leftover throwing ReferenceError: MathJax is not defined.
    """
    # External CDN script tags (e.g. https://cdn.jsdelivr.net/npm/mathjax@3/...)
    html = re.sub(
        r"<script\b[^>]*\bsrc\s*=\s*[\"'][^\"']*cdn\.jsdelivr\.net[^\"']*mathjax[^\"']*[\"'][^>]*>\s*</script>",
        "",
        html,
        flags=re.IGNORECASE,
    )
    # Inline (no src) scripts that (re)define window.MathJax or drive its startup.
    html = re.sub(
        r"<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?MathJax[\s\S]*?</script>",
        "",
        html,
        flags=re.IGNORECASE,
    )
    return html


def _optimize_math_injection(html: str) -> str:
    if not _has_latex(html):
        return html

    if _has_mathjax(html):
        html = _strip_mathjax(html)
        html = _clean_mathjax_broken_katex(html)

    katex_css = '<link rel="stylesheet" href="/static/lib/katex/katex.min.css" crossorigin="anonymous">'
    katex_js = '<script src="/static/lib/katex/katex.min.js" crossorigin="anonymous"></script>'
    auto_render_js = '<script src="/static/lib/katex/contrib/auto-render.min.js" crossorigin="anonymous"></script>'
    render_call = (
        "<script>"
        'document.addEventListener("DOMContentLoaded",function(){'
        'if(typeof renderMathInElement==="function"){'
        "renderMathInElement(document.body,{delimiters:["
        '{left:"$$",right:"$$",display:true},'
        '{left:"$",right:"$",display:false},'
        '{left:"\\\\[",right:"\\\\]",display:true},'
        '{left:"\\\\(",right:"\\\\)",display:false}'
        "]});"
        "}"
        "});"
        "</script>"
    )

    has_head = "<head>" in html.lower()
    has_body_close = "</body>" in html.lower()
    has_doctype = html.strip().upper().startswith("<!DOCTYPE")

    if not has_head and not has_body_close and not has_doctype:
        html = (
            "<!DOCTYPE html><html><head>"
            "<meta charset='UTF-8'>"
            "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
            + katex_css
            + "</head><body>"
            + html
            + katex_js
            + auto_render_js
            + render_call
            + "</body></html>"
        )
        return html

    html = html.replace("<head>", "<head>" + katex_css, 1) if has_head else katex_css + html

    katex_scripts = katex_js + auto_render_js + render_call

    if has_body_close:
        html = html.replace("</body>", katex_scripts + "</body>", 1)
    else:
        html += katex_scripts

    return html


def _inject_katex(html: str) -> str:
    return _optimize_math_injection(html)


# ── Media optimization for low-bandwidth (2G/3G) delivery ──
class _MediaOptimizer(HTMLParser):
    """Add bandwidth-friendly attributes to <img>/<video> in lesson HTML.

    - <img>: lazy-load + async decode + never overflow the viewport.
    - <video>: do NOT preload (avoids 50 MB auto-downloads on 3G), allow inline
      playback, always show controls. Adaptive HLS/DASH transcoding is a separate
      backend pipeline (see PERFORMANCE_OPTIMIZATION_PLAN.md P1-5); this at least
      stops the browser from pulling the whole file before the user hits play.
    """

    VOID = {"img", "br", "hr", "input", "meta", "link", "source", "area", "base", "col", "embed", "param", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []

    @staticmethod
    def _render(tag: str, attrs: dict[str, str], void: bool) -> str:
        parts = []
        for k, v in attrs.items():
            parts.append(k if v == "" else f'{k}="{html.escape(v, quote=True)}"')
        rendered = f"<{tag}{(' ' + ' '.join(parts)) if parts else ''}>"
        return rendered

    def _img_attrs(self, attrs):
        d = {k.lower(): (v if v is not None else "") for k, v in attrs}
        d.setdefault("loading", "lazy")
        d.setdefault("decoding", "async")
        d.setdefault("referrerpolicy", "no-referrer")
        style = d.get("style", "")
        if "max-width" not in style:
            d["style"] = (style + ";max-width:100%;height:auto").strip(";")
        return d

    def _video_attrs(self, attrs):
        d = {k.lower(): (v if v is not None else "") for k, v in attrs}
        d.setdefault("preload", "none")
        d.setdefault("playsinline", "")
        d.setdefault("controls", "")
        style = d.get("style", "")
        if "max-width" not in style:
            d["style"] = (style + ";max-width:100%").strip(";")
        return d

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "img":
            self.out.append(self._render("img", self._img_attrs(attrs), True))
        elif tag == "video":
            self.out.append(self._render("video", self._video_attrs(attrs), False))
        else:
            self.out.append(self._render(tag, {k.lower(): (v if v is not None else "") for k, v in attrs}, tag in self.VOID))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag.lower() not in self.VOID:
            self.out.append(f"</{tag.lower()}>")

    def handle_endtag(self, tag):
        self.out.append(f"</{tag.lower()}>")

    def handle_data(self, data):
        self.out.append(data)

    def handle_comment(self, data):
        self.out.append(f"<!--{data}-->")

    def handle_decl(self, data):
        self.out.append(f"<!{data}>")

    def handle_pi(self, data):
        self.out.append(f"<?{data}?>")

    def handle_entityref(self, name):
        self.out.append(f"&{name};")

    def handle_charref(self, name):
        self.out.append(f"&#{name};")


def optimize_media(html: str) -> str:
    """Make images/video in served lesson HTML cheap to load on slow networks."""
    try:
        parser = _MediaOptimizer()
        parser.feed(html)
        return parser.out and "".join(parser.out) or html
    except Exception:
        return html  # best-effort; never break lesson rendering


def read_lesson_content(slug: str) -> str | None:
    cached = _cache_get(slug)
    if cached is not None:
        return cached

    _gen = get_db()
    db: Session = next(_gen)
    try:
        lesson = db.query(Lesson).filter(Lesson.slug == slug).first()
        if lesson and lesson.content:
            html = lesson.content
        else:
            html = _migrate_old_package(slug)
            if html is None:
                return None
    finally:
        _gen.close()

    html = _inject_katex(html)
    html = optimize_media(html)
    _cache_set(slug, html)
    return html


def create_lesson_from_html(subtopic_id: str, title: str, html: str) -> dict:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        slug = title.lower().replace(" ", "-") + "-" + uuid.uuid4().hex[:8]
        content_hash = hashlib.sha256(html.encode()).hexdigest()
        lesson = Lesson(
            subtopic_id=subtopic_id,
            slug=slug,
            title=title,
            content_hash=content_hash,
            content=html,
        )
        db.add(lesson)
        db.flush()
        version = LessonVersion(
            lesson_id=lesson.id,
            package_version="1.0.0",
            content_hash=content_hash,
            content=html,
            package_path=f"db://{slug}",
        )
        db.add(version)
        db.commit()
        return {
            "id": lesson.id,
            "slug": slug,
            "title": title,
            "content_hash": content_hash,
            "package_version": "1.0.0",
            "status": "draft",
        }
    finally:
        _gen.close()


def publish_lesson(lesson_id: str) -> dict:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
        if not lesson:
            raise ValueError("Lesson not found")
        lesson.status = "published"
        db.commit()
        return {"id": lesson.id, "slug": lesson.slug, "status": "published"}
    finally:
        _gen.close()


def delete_lesson(lesson_id: str) -> dict:
    engine = get_engine()
    raw_conn = engine.raw_connection()
    try:
        cur = raw_conn.cursor()
        cur.execute("SELECT id FROM lessons WHERE id = %s", (lesson_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError("Lesson not found")

        cur.execute(
            "DELETE FROM quiz_options WHERE question_id IN (SELECT id FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE lesson_id = %s))",
            (lesson_id,),
        )
        cur.execute(
            "DELETE FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE lesson_id = %s)", (lesson_id,)
        )
        cur.execute("DELETE FROM quizzes WHERE lesson_id = %s", (lesson_id,))
        cur.execute("DELETE FROM lesson_versions WHERE lesson_id = %s", (lesson_id,))
        cur.execute("DELETE FROM progress_records WHERE lesson_id = %s", (lesson_id,))
        cur.execute("DELETE FROM lesson_analytics_snapshots WHERE lesson_id = %s", (lesson_id,))
        cur.execute("DELETE FROM bookmarks WHERE lesson_id = %s", (lesson_id,))
        cur.execute("DELETE FROM notes WHERE lesson_id = %s", (lesson_id,))
        cur.execute("DELETE FROM games WHERE lesson_id = %s", (lesson_id,))
        cur.execute("DELETE FROM lessons WHERE id = %s", (lesson_id,))
        raw_conn.commit()
        cur.close()
        return {"detail": "Lesson deleted"}
    except Exception:
        raw_conn.rollback()
        raise
    finally:
        raw_conn.close()


def get_lesson(lesson_id: str) -> dict | None:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
        if not lesson:
            return None
        return {
            "id": lesson.id,
            "subtopic_id": lesson.subtopic_id,
            "slug": lesson.slug,
            "title": lesson.title,
            "content_hash": lesson.content_hash,
            "content": lesson.content,
            "package_version": lesson.package_version,
            "status": lesson.status,
        }
    finally:
        _gen.close()


def update_lesson(lesson_id: str, title: str | None = None, html: str | None = None) -> dict:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
        if not lesson:
            raise ValueError("Lesson not found")
        if title is not None:
            lesson.title = title
        if html is not None:
            content_hash = hashlib.sha256(html.encode()).hexdigest()
            lesson.content_hash = content_hash
            lesson.content = html
            version = LessonVersion(
                lesson_id=lesson.id,
                package_version="1.0.0",
                content_hash=content_hash,
                content=html,
                package_path=f"db://{lesson.slug}",
            )
            db.add(version)
            _cache_invalidate_content(lesson.slug)
        db.commit()
        return {"id": lesson.id, "slug": lesson.slug, "title": lesson.title, "status": lesson.status}
    finally:
        _gen.close()


def list_lessons(
    subtopic_id: str | None = None, status: str | None = None, skip: int = 0, limit: int = 100
) -> list[dict]:
    _gen = get_db()
    db: Session = next(_gen)
    try:
        query = db.query(Lesson)
        if subtopic_id:
            query = query.filter(Lesson.subtopic_id == subtopic_id)
        if status:
            query = query.filter(Lesson.status == status)
        lessons = query.offset(skip).limit(limit).all()
        return [
            {
                "id": l.id,
                "subtopic_id": l.subtopic_id,
                "slug": l.slug,
                "title": l.title,
                "status": l.status,
            }
            for l in lessons
        ]
    finally:
        _gen.close()
