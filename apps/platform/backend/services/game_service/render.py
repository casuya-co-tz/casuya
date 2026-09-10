"""Rendering of self-contained playable game HTML."""

from __future__ import annotations

import json


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