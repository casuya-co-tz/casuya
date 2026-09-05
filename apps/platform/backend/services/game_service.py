import hashlib
import json
import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from backend.config.settings import get_settings
from backend.models.game import Game
from backend.services.html_assets import rewrite_external_assets

settings = get_settings()


def _get_game_pkg_path(slug: str) -> Path:
    storage = Path(settings.storage_root) / "game-packages"
    if len(slug) < 4:
        return storage / f"{slug}.html"
    return storage / slug[:2] / slug[2:4] / f"{slug}.html"


def get_games_for_lesson(db: Session, lesson_id: str) -> list[dict]:
    games = db.query(Game).filter(Game.lesson_id == lesson_id).all()
    return [
        {
            "id": g.id,
            "lesson_id": g.lesson_id,
            "title": g.title,
            "slug": g.slug,
            "content_hash": g.content_hash,
            "status": g.status,
        }
        for g in games
    ]


def list_games(db: Session, offset: int = 0, limit: int = 200) -> dict:
    total = db.query(Game).count()
    games = db.query(Game).offset(offset).limit(limit).all()
    return {
        "items": [
            {
                "id": g.id,
                "lesson_id": g.lesson_id,
                "title": g.title,
                "slug": g.slug,
                "status": g.status,
                "content_hash": g.content_hash,
            }
            for g in games
        ],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


def get_game(db: Session, game_id: str) -> dict | None:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        return None
    return {
        "id": game.id,
        "lesson_id": game.lesson_id,
        "title": game.title,
        "slug": game.slug,
        "status": game.status,
        "content_hash": game.content_hash,
    }


def read_game_content(db: Session, slug: str) -> str | None:
    game = db.query(Game).filter(Game.slug == slug).first()
    if game and game.package_html:
        return rewrite_external_assets(game.package_html)
    pkg_path = _get_game_pkg_path(slug)
    if pkg_path.exists():
        return rewrite_external_assets(pkg_path.read_text(encoding="utf-8"))
    return None


def _build_structured_game_html(title: str, questions: list[dict]) -> str:
    """Render a self-contained playable HTML quiz from structured questions.

    Each question is expected as {"prompt": str, "options": [{"text": str, "is_correct": bool}, ...]}.
    """
    questions_json = []
    for q in questions:
        prompt = str(q.get("prompt", "")).strip()
        if not prompt:
            continue
        options = []
        for opt in q.get("options", []):
            options.append(
                {
                    "text": str(opt.get("text", "")),
                    "is_correct": bool(opt.get("is_correct", False)),
                }
            )
        if not any(o.get("is_correct") for o in options):
            continue
        questions_json.append({"prompt": prompt, "options": options})

    if not questions_json:
        raise ValueError("A structured game needs at least one question with a correct answer")

    json_payload = json.dumps(questions_json, ensure_ascii=False)
    # Prevent a literal </script> in any prompt/option from terminating the
    # <script> block the JSON is embedded in (HTML spec never treats "<\/"
    # as an end-tag open, and JSON.parse accepts the backslash escape).
    json_payload = json_payload.replace("</", "<\\/")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{_html_escape(title)}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         background: #f3f4f6; color: #1f2937; padding: 16px; }}
  .game {{ max-width: 640px; margin: 0 auto; }}
  h1 {{ font-size: 1.25rem; margin-bottom: 16px; text-align: center; }}
  .screen {{ background: #fff; border-radius: 12px; padding: 20px;
             box-shadow: 0 1px 3px rgba(0,0,0,.1); }}
  .hidden {{ display: none; }}
  .prompt {{ font-size: 1rem; font-weight: 600; margin-bottom: 16px; }}
  .opt {{ display: block; width: 100%; text-align: left; margin-bottom: 8px;
         padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 8px;
         background: #fff; cursor: pointer; font-size: .95rem; }}
  .opt:hover {{ border-color: #2563eb; }}
  .opt.correct {{ background: #dcfce7; border-color: #16a34a; }}
  .opt.wrong {{ background: #fee2e2; border-color: #dc2626; }}
  .opt:disabled {{ cursor: default; }}
  .btn {{ display: inline-block; margin-top: 16px; padding: 10px 20px;
         border: none; border-radius: 8px; background: #2563eb; color: #fff;
         font-size: .95rem; cursor: pointer; }}
  .btn:disabled {{ opacity: .6; cursor: default; }}
  .result {{ text-align: center; font-size: 1.05rem; }}
  #score {{ font-size: 2rem; font-weight: 800; color: #2563eb; }}
</style>
</head>
<body>
<div class="game">
  <h1>{_html_escape(title)}</h1>
  <div id="intro" class="screen">
    <p style="text-align:center;color:#6b7280;margin-bottom:8px">Answer all questions to finish the game.</p>
    <button class="btn" id="start">Start</button>
  </div>
  <div id="q" class="screen hidden">
    <p id="progress" style="color:#6b7280;font-size:.85rem;margin-bottom:8px"></p>
    <p id="prompt" class="prompt"></p>
    <div id="options"></div>
    <button class="btn hidden" id="next">Next</button>
  </div>
  <div id="out" class="screen hidden result">
    <p>You answered</p>
    <p id="score">0/0</p>
    <button class="btn" id="restart">Play Again</button>
  </div>
</div>
<script>
const Q = {json_payload};
let idx = 0, correct = 0, locked = false;

function show(el) {{ el.classList.remove('hidden'); }}
function hide(el) {{ el.classList.add('hidden'); }}

document.getElementById('start').onclick = function() {{
  idx = 0; correct = 0;
  hide(document.getElementById('intro'));
  show(document.getElementById('q'));
  render();
}};

document.getElementById('restart').onclick = function() {{
  hide(document.getElementById('out'));
  show(document.getElementById('intro'));
}};

document.getElementById('next').onclick = function() {{
  idx++;
  if (idx >= Q.length) {{
    hide(document.getElementById('q'));
    show(document.getElementById('out'));
    document.getElementById('score').textContent = correct + '/' + Q.length;
    return;
  }}
  render();
}};

function render() {{
  locked = false;
  const q = Q[idx];
  document.getElementById('progress').textContent = 'Question ' + (idx + 1) + ' of ' + Q.length;
  document.getElementById('prompt').textContent = q.prompt;
  const box = document.getElementById('options');
  box.innerHTML = '';
  const nextBtn = document.getElementById('next');
  hide(nextBtn);
  q.options.forEach(function(opt, i) {{
    const b = document.createElement('button');
    b.className = 'opt';
    b.textContent = opt.text;
    b.onclick = function() {{
      if (locked) return;
      locked = true;
      if (opt.is_correct) {{ correct++; }}
      const btns = box.querySelectorAll('.opt');
      q.options.forEach(function(o, j) {{
        if (o.is_correct) btns[j].classList.add('correct');
        btns[j].disabled = true;
      }});
      if (!opt.is_correct) btns[i].classList.add('wrong');
      show(nextBtn);
    }};
    box.appendChild(b);
  }});
}}
</script>
</body>
</html>"""


def _html_escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def create_structured_game(
    db: Session,
    lesson_id: str | None,
    title: str,
    questions: list[dict],
    options: list[dict] | None = None,
) -> dict:
    html = _build_structured_game_html(title, questions)
    return create_game_from_html(db, lesson_id=lesson_id, title=title, html=html)


def create_game_from_html(
    db: Session,
    lesson_id: str | None,
    title: str,
    html: str,
) -> dict:
    slug = title.lower().replace(" ", "-") + "-" + uuid.uuid4().hex[:8]
    content_hash = hashlib.sha256(html.encode()).hexdigest()
    pkg_path = _get_game_pkg_path(slug)
    resolved_lesson_id = lesson_id or None
    game = Game(
        lesson_id=resolved_lesson_id,
        title=title,
        slug=slug,
        package_path=str(pkg_path),
        package_html=html,
        content_hash=content_hash,
    )
    db.add(game)
    db.flush()
    pkg_path.parent.mkdir(parents=True, exist_ok=True)
    pkg_path.write_text(html, encoding="utf-8")
    db.commit()
    return {"id": game.id, "slug": slug, "title": title, "content_hash": content_hash, "status": "draft"}


def publish_game(db: Session, game_id: str) -> dict:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise ValueError("Game not found")
    game.status = "published"
    db.commit()
    return {"id": game.id, "slug": game.slug, "status": "published"}


def delete_game(db: Session, game_id: str) -> dict:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise ValueError("Game not found")
    slug = game.slug
    db.delete(game)
    db.commit()
    if slug:
        pkg_path = _get_game_pkg_path(slug)
        if pkg_path.exists():
            pkg_path.unlink()
    return {"detail": "Game deleted"}


def update_game(
    db: Session,
    game_id: str,
    title: str | None = None,
    html: str | None = None,
) -> dict:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise ValueError("Game not found")
    if title is not None:
        game.title = title
    if html is not None:
        content_hash = hashlib.sha256(html.encode()).hexdigest()
        game.content_hash = content_hash
        game.package_html = html
        pkg_path = _get_game_pkg_path(game.slug)
        game.package_path = str(pkg_path)
        pkg_path.parent.mkdir(parents=True, exist_ok=True)
        pkg_path.write_text(html, encoding="utf-8")
    db.commit()
    return {"id": game.id, "slug": game.slug, "title": game.title, "status": game.status}
