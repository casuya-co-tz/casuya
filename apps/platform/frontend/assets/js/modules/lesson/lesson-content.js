// modules/lesson/lesson-content.js — lesson content builders (classic script, shared global scope).
// Extracted from modules/lesson.js: the bridge script injected into each lesson iframe
// and the quiz / games section renderers used by lesson-viewer.js.

// Injected just before </body> of every lesson so the sandboxed lesson iframe can report
// quiz scores, progress and video milestones back to the parent page.
const LESSON_BRIDGE_SCRIPT = `
<script>
(function(){
  var scoreReported = false;
  window.casuya = window.casuya || {};
  window.casuya.reportScore = function(score, total) {
    parent.postMessage({type:'casuya-quiz', score:score, total:total}, '*');
    scoreReported = true;
  };
  window.casuya.reportProgress = function(pct) {
    parent.postMessage({type:'casuya-progress', percent:pct}, '*');
  };
  function detectScore() {
    if (scoreReported) return;
    var candidates = document.querySelectorAll('.score-big, .quiz-score, .final-score, .result-score, [class*=score]');
    for (var i = 0; i < candidates.length; i++) {
      var text = (candidates[i].textContent || '').trim();
      var m = text.match(/(\d+)\s*\/\s*(\d+)/);
      if (m) {
        var s = parseInt(m[1]), t = parseInt(m[2]);
        if (t > 0 && s <= t) {
          parent.postMessage({type:'casuya-quiz', score:s, total:t}, '*');
          scoreReported = true;
          return;
        }
      }
    }
  }
  function upgradeAdaptiveVideos(root) {
    var videos = root.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      (function (v) {
        var src = v.getAttribute('src') || '';
        // Only act on HLS manifests; plain mp4/webm stay as-is (P1-5).
        if (!/\.m3u8(\?|$)/.test(src)) return;
        if (v.dataset.casuyaHls) return;
        v.dataset.casuyaHls = '1';
        v.setAttribute('preload', v.getAttribute('preload') || 'none');
        // Native HLS (Safari / iOS) needs no library.
        if (v.canPlayType('application/vnd.apple.mpegurl')) return;
        function attach(Hls) {
          if (!Hls || !Hls.isSupported()) return;
          var hls = new Hls({ maxBufferLength: 10, capLevelToPlayerSize: true, startLevel: -1 });
          hls.loadSource(src);
          hls.attachMedia(v);
        }
        if (window.Hls) { attach(window.Hls); return; }
        // Lazy-load the vendored hls.js only when actually needed (no-op if absent).
        var s = document.createElement('script');
        s.src = '/static/lib/hls.min.js';
        s.onload = function () { attach(window.Hls); };
        document.head.appendChild(s);
      })(videos[i]);
    }
  }
  function trackVideos(root) {
    var videos = root.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      (function(v) {
        if (v.dataset.casuyaTracked) return;
        v.dataset.casuyaTracked = '1';
        var maxPct = 0;
        v.addEventListener('timeupdate', function() {
          if (v.duration) { var pct = Math.round((v.currentTime / v.duration) * 100); if (pct > maxPct) maxPct = pct; }
        });
        v.addEventListener('ended', function() { parent.postMessage({type:'casuya-video', percent:100}, '*'); });
        var _iv = setInterval(function() { if (maxPct > 0) parent.postMessage({type:'casuya-progress', percent:Math.min(maxPct + 10, 100)}, '*'); }, 5000);
        window.casuya._intervals = window.casuya._intervals || [];
        window.casuya._intervals.push(_iv);
      })(videos[i]);
    }
  }
  function initBridge() {
    if (!document.body) { setTimeout(initBridge, 100); return; }
    upgradeAdaptiveVideos(document.body);
    trackVideos(document.body);
    detectScore();
    var obs = new MutationObserver(function() { detectScore(); upgradeAdaptiveVideos(document.body); trackVideos(document.body); });
    obs.observe(document.body, {childList:true, subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBridge);
  else initBridge();
})();
<\/script>`;

// Quiz section rendered below the lesson iframe for students. Returns "" when there
// is no quiz to show. `lessonId` is embedded so each question's "Show your work"
// blackboard gets a unique board id.
function renderLessonQuiz(quizData, lessonId) {
  if (!quizData || !quizData.questions || quizData.questions.length === 0) return "";
  return `
    <div class="card" style="margin-top:1rem;padding:1rem">
      <h3 style="margin:0 0 0.75rem">${escapeHtml(quizData.title || "Quiz")}</h3>
      <form id="quiz-form">
        ${quizData.questions.map((q, qi) => `
          <div style="margin-bottom:1rem">
            <p style="font-weight:600;margin:0 0 0.5rem">${qi + 1}. ${escapeHtml(q.prompt)}</p>
            ${q.options.map(o => `
              <label style="display:block;padding:0.3rem 0.5rem;cursor:pointer;border:1px solid var(--color-border);border-radius:var(--radius);margin-bottom:0.25rem">
                <input type="radio" name="q_${escapeHtml(q.id)}" value="${escapeHtml(o.id)}" required> ${escapeHtml(o.text)}
              </label>
            `).join("")}
            <details style="margin-top:0.5rem">
              <summary style="cursor:pointer;font-size:0.85rem;color:var(--color-text-muted)">Show your work</summary>
              <div data-blackboard data-lesson-id="${escapeHtml(lessonId)}-${escapeHtml(q.id)}" data-quiz-question="${escapeHtml(q.id)}" style="width:100%;height:250px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden;margin-top:0.5rem"></div>
            </details>
          </div>
        `).join("")}
        <button type="submit" class="btn btn-primary" id="quiz-submit-btn">Submit Quiz</button>
      </form>
      <div id="quiz-result" style="display:none;margin-top:0.75rem"></div>
    </div>
  `;
}

// Games & Activities section rendered below the quiz for students. Returns "" when
// there are no games to show.
function renderLessonGames(gamesData) {
  if (!Array.isArray(gamesData) || gamesData.length === 0) return "";
  return `
    <div class="card" style="margin-top:1rem;padding:1rem">
      <h3 style="margin:0 0 0.5rem">Games & Activities</h3>
      ${gamesData.map(g => `
        <div class="game-item" data-game-id="${escapeHtml(g.id)}" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border);cursor:pointer">
          <span style="color:var(--color-primary)">${escapeHtml(g.title || "Game")}</span>
          <span style="color:var(--color-text-muted);font-size:0.8rem;margin-left:0.5rem">${escapeHtml(g.status || "draft")}</span>
        </div>
      `).join("")}
      <div id="game-content-area" style="margin-top:1rem"></div>
    </div>
  `;
}