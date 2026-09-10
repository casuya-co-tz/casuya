// modules/student/games.js — games list and game viewer.

"use strict";

function registerGamesView(d) {
  async function loadStudentGames() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading games...</p></div>');
    try {
      const games = await request("/games");
      const gameList = Array.isArray(games?.items) ? games.items : [];

      let recent = [];
      try { recent = d.getRecentlyViewed(); } catch(e) {}

      if (gameList.length === 0 && recent.length === 0) {
        d.showView(`
          <h2>Games</h2>
          <div class="empty-state" style="margin-top:1rem">
            <p>No games available yet.</p>
            <p style="color:var(--color-text-muted);font-size:0.85rem">Games are added by your teacher and appear inside lessons.</p>
            <button class="btn btn-primary" id="browse-lessons-btn" style="margin-top:1rem">Browse Lessons</button>
          </div>
        `);
        document.getElementById("browse-lessons-btn")?.addEventListener("click", () => {
          d.setActiveNav("subjects");
          d.callView("subjects");
        });
        return;
      }

      d.showView(`
        <h2>Games</h2>
        ${gameList.length > 0 ? `
          <div class="card-grid" style="margin-top:1rem">
            ${gameList.map(g => `
              <div class="card game-card" data-id="${escapeHtml(g.id)}" style="cursor:pointer;position:relative">
                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
                  <span style="font-size:1.5rem">🎮</span>
                  <h3 style="margin:0">${escapeHtml(g.title || "Untitled Game")}</h3>
                </div>
                <p style="color:var(--color-text-muted);font-size:0.85rem">${escapeHtml(g.lesson_title || "Standalone game")}</p>
                <span style="display:inline-block;margin-top:0.5rem;font-size:0.75rem;padding:0.2rem 0.6rem;background:var(--color-bg);border-radius:var(--radius);color:var(--color-text-muted)">${escapeHtml(g.status || "active")}</span>
              </div>
            `).join("")}
          </div>
        ` : `
          <div class="empty-state" style="padding:2rem">
            <p>No standalone games found.</p>
          </div>
        `}
      `);

      document.querySelectorAll(".game-card").forEach(card => {
        card.addEventListener("click", () => d.callView("game", card.dataset.id));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading games</p></div>'); }
  }

  async function viewStudentGame(gameId) {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading game...</p></div>');
    try {
      const game = await request(`/games/${gameId}`);
      const contentResp = await fetch(`${API_BASE}/games/${gameId}/content`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
      }).then(r => r.ok ? r.text() : "").catch(() => "");

      d.showView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2 style="flex:1">${escapeHtml(game.title || "Game")}</h2>
        </div>
        <div style="width:100%">
          <iframe class="lesson-iframe" style="width:100%;border:none;display:block"></iframe>
        </div>
        <div class="card" style="margin-top:0.75rem;padding:1rem">
          <h3 style="margin:0 0 0.5rem">✏️ Scratch Pad</h3>
          <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Work out problems here while you play.</p>
          <div data-blackboard data-lesson-id="game-${gameId}" style="width:100%;height:300px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
        </div>
      `);

      const iframe = document.querySelector("#student-content .lesson-iframe");
      if (iframe && contentResp) {
        iframe.srcdoc = injectNodeBase(contentResp);
        let heightSet = false;
        const setHeight = () => {
          if (heightSet) return;
          try {
            const doc = iframe.contentWindow?.document;
            if (doc) {
              iframe.style.height = Math.max(doc.documentElement?.scrollHeight || 0, doc.body?.scrollHeight || 0, 300) + "px";
              heightSet = true;
            }
          } catch(e) {}
        };
        iframe.addEventListener("load", setHeight);
        const poll = setInterval(() => { setHeight(); if (heightSet) clearInterval(poll); }, 300);
        setTimeout(() => { clearInterval(poll); if (!heightSet) iframe.style.height = "600px"; }, 8000);
      } else if (iframe) {
        iframe.style.height = "400px";
        iframe.srcdoc = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-family:sans-serif"><p>Game content not available</p></div>';
      }

      document.getElementById("back-btn").addEventListener("click", () => d.goBack());
      if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading game</p><button class="btn" id="back-btn">← Back</button></div>'); document.getElementById("back-btn")?.addEventListener("click", () => d.goBack()); }
  }

  d.registerView("games", loadStudentGames);
  d.registerView("game", viewStudentGame);
}
