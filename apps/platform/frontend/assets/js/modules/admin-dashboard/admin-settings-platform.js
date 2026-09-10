  function renderPlatformTab(panel, platformStatus, branding, API_BASE) {
    var ps = platformStatus || null;
    function _statusBadge(ok, okText, noText) {
      return ok
        ? '<span style="font-size:0.8rem;font-weight:600;color:var(--color-success)">● ' + okText + '</span>'
        : '<span style="font-size:0.8rem;font-weight:600;color:var(--color-danger)">● ' + noText + '</span>';
    }
    function _sourceBadge(src) {
      return src === "env"
        ? '<span style="font-size:0.7rem;padding:0.1rem 0.4rem;border-radius:999px;background:var(--color-surface-2,#eef2f7);color:var(--color-text-muted)">env</span>'
        : '<span style="font-size:0.7rem;padding:0.1rem 0.4rem;border-radius:999px;border:1px solid var(--color-border);color:var(--color-text-muted)">default</span>';
    }
    var runtimeHtml = '';
    if (ps && ps.runtime) {
      runtimeHtml = [
        ["Database", ps.runtime.database],
        ["Redis", ps.runtime.redis],
        ["SMTP/Email", ps.runtime.smtp],
      ].map(function (kv) {
        return '<div style="border:1px solid var(--color-border);border-radius:var(--radius);padding:0.75rem;text-align:center">'
          + '<div style="font-size:0.75rem;color:var(--color-text-muted);margin-bottom:0.25rem">' + kv[0] + '</div>'
          + _statusBadge(!!kv[1], "Healthy", "Down") + '</div>';
      }).join('');
      runtimeHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.75rem;margin:1rem 0 1.25rem">' + runtimeHtml + '</div>';
    }
    var backendHtml = '';
    if (ps && Array.isArray(ps.backend) && ps.backend.length) {
      var groups = {};
      ps.backend.forEach(function (v) { (groups[v.group] = groups[v.group] || []).push(v); });
      backendHtml = Object.keys(groups).map(function (g) {
        var rows = groups[g].map(function (v) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:0.55rem 0;border-bottom:1px solid var(--color-border)">'
            + '<div style="min-width:0">'
            + '<div style="font-size:0.9rem">' + escapeHtml(v.label) + '</div>'
            + '<div style="font-size:0.72rem;font-family:monospace;color:var(--color-text-muted)">' + escapeHtml(v.name) + '</div>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0">'
            + '<span style="font-size:0.8rem;color:var(--color-text-muted)">' + escapeHtml(v.value) + '</span>'
            + _sourceBadge(v.source)
            + (v.configured ? '<span style="color:var(--color-success);font-size:0.9rem">✓</span>' : '<span style="color:var(--color-danger);font-size:0.9rem">—</span>')
            + '</div></div>';
        }).join('');
        return '<div style="margin:0 0 0.25rem">'
          + '<div style="font-weight:600;font-size:0.85rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.04em;padding:0.6rem 0 0.25rem">' + escapeHtml(g) + '</div>'
          + rows + '</div>';
      }).join('');
    } else {
      backendHtml = '<p style="font-size:0.85rem;color:var(--color-text-muted)">Platform status unavailable.</p>';
    }
    var uiLang = (window.CasuyaI18n && typeof window.CasuyaI18n.getLang === "function") ? window.CasuyaI18n.getLang() : "en";
    var feVars = [
      ["API Base", window.API_BASE || ""],
      ["API Host", window.API_HOST || ""],
      ["API Protocol", window.API_PROTOCOL || ""],
      ["CASUYA_API_URL", window.CASUYA_API_URL || ""],
      ["UI Language", uiLang],
    ];
    var frontendHtml = feVars.map(function (v) {
      var set = !!v[1];
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:0.55rem 0;border-bottom:1px solid var(--color-border)">'
        + '<div style="font-size:0.9rem">' + escapeHtml(v[0]) + '</div>'
        + '<div style="display:flex;align-items:center;gap:0.5rem">'
        + '<span style="font-size:0.8rem;font-family:monospace;color:var(--color-text-muted)">' + escapeHtml(String(v[1] || "(unset)")) + '</span>'
        + (set ? '<span style="color:var(--color-success);font-size:0.9rem">✓</span>' : '<span style="color:var(--color-danger);font-size:0.9rem">—</span>')
        + '</div></div>';
    }).join('');

    panel.innerHTML = `
      <div class="card" style="padding:1.5rem">
        <h3 style="margin-bottom:0.5rem">Platform Information</h3>
        <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--color-border)">
          <span style="color:var(--color-text-muted);font-size:0.9rem">Environment</span>
          <strong style="font-size:0.9rem">${escapeHtml((ps && ps.environment) || (window.API_BASE ? "production" : "development"))}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--color-border)">
          <span style="color:var(--color-text-muted);font-size:0.9rem">API Base</span>
          <strong style="font-size:0.9rem">${escapeHtml(API_BASE)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--color-border)">
          <span style="color:var(--color-text-muted);font-size:0.9rem">Logo</span>
          <strong style="font-size:0.9rem">${branding ? "Custom" : "Default"}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--color-border)">
          <span style="color:var(--color-text-muted);font-size:0.9rem">Version</span>
          <strong style="font-size:0.9rem">1.0.0</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:0.6rem 0">
          <span style="color:var(--color-text-muted);font-size:0.9rem">Status</span>
          <span style="font-size:0.9rem;color:var(--color-success);font-weight:600">● Online</span>
        </div>

        <h3 style="margin:1.5rem 0 0.25rem">Runtime Health</h3>
        <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:0">Live connectivity checks against the services the platform depends on.</p>
        ${runtimeHtml}

        <h3 style="margin:1.75rem 0 0.5rem">Backend Environment Variables</h3>
        <p style="font-size:0.85rem;color:var(--color-text-muted)">Configured status of every backend setting, drawn from environment variables. Secret values are masked. <span style="font-size:0.8rem">env = set in the environment · default = using the bundled default.</span></p>
        ${backendHtml}

        <h3 style="margin:1.75rem 0 0.5rem">Frontend Environment</h3>
        <p style="font-size:0.85rem;color:var(--color-text-muted)">Values resolved in the browser from the served frontend.</p>
        ${frontendHtml}
      </div>
      <div class="card" style="padding:1.5rem;margin-top:1rem" id="module-visibility-card">
        <h3 style="margin-bottom:0.25rem">Module Visibility</h3>
        <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:1rem">Toggle which sidebar modules are visible to students and teachers. Hidden modules can be re-enabled anytime.</p>
        <div id="module-vis-loading" style="text-align:center;padding:1rem;color:var(--color-text-muted);font-size:0.85rem">Loading...</div>
      </div>
      <div class="card" style="padding:1.5rem;margin-top:1rem">
        <h3 style="margin-bottom:0.75rem">⚠️ Danger Zone</h3>
        <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:0.75rem">Irreversible actions</p>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button class="btn btn-danger btn-sm btn-pattern" id="clear-cache-btn">🗑️ Clear Cache</button>
          <button class="btn btn-outline-danger btn-sm" id="export-data-btn">📦 Export All Data</button>
        </div>
        <div id="danger-msg" style="font-size:0.85rem;margin-top:0.5rem"></div>
      </div>
    `;
    document.getElementById("clear-cache-btn")?.addEventListener("click", () => {
      requestCache.clear();
      const msg = document.getElementById("danger-msg");
      msg.textContent = "In-memory cache cleared"; msg.style.color = "var(--color-success)";
    });
    document.getElementById("export-data-btn")?.addEventListener("click", async () => {
      const msg = document.getElementById("danger-msg");
      try {
        const [students, teachers, subjects, lessons] = await Promise.all([
          request("/students"), request("/teachers"), request("/subjects"), request("/lessons"),
        ]);
        const data = { students, teachers, subjects, lessons, exported_at: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "casuya-export.json"; a.click();
        URL.revokeObjectURL(url);
        msg.textContent = "Data exported"; msg.style.color = "var(--color-success)";
      } catch(err) { msg.textContent = err.message; msg.style.color = "var(--color-danger)"; }
    });
    (async function() {
      var loading = document.getElementById("module-vis-loading");
      if (!loading) return;
      try {
        var vis = await request("/settings/modules");
        var studentMods = vis.student || {};
        var teacherMods = vis.teacher || {};
        var studentLabels = {dashboard:"Dashboard",subjects:"Subjects",progress:"Progress",bookmarks:"Bookmarks",assignments:"Assignments",games:"Games",downloads:"Downloads",exams:"Exams",files:"Files",payments:"Payments",notifications:"Notifications",settings:"Settings"};
        var teacherLabels = {overview:"Overview",class:"My Class",students:"Students",lessons:"Lessons",assignments:"Assignments",reports:"Reports","ai-assistant":"AI Assistant","teaching-docs":"Teaching Docs",bookmarks:"Bookmarks",files:"Files",payments:"Payments",notifications:"Notifications",settings:"Settings"};
        function buildSection(title, mods, labels) {
          var html = '<div style="margin-bottom:1rem"><div style="font-weight:600;font-size:0.9rem;margin-bottom:0.5rem">' + title + '</div>';
          var keys = Object.keys(labels);
          for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            var enabled = mods[key] !== false;
            html += '<label style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid var(--color-border);cursor:pointer;font-size:0.85rem">';
            html += '<input type="checkbox" data-role="' + title.toLowerCase() + '" data-mod="' + key + '"' + (enabled ? ' checked' : '') + ' style="accent-color:var(--color-primary);width:16px;height:16px">';
            html += '<span>' + labels[key] + '</span>';
            html += '</label>';
          }
          html += '</div>';
          return html;
        }
        loading.outerHTML = buildSection("Student", studentMods, studentLabels) + buildSection("Teacher", teacherMods, teacherLabels) + '<p id="module-vis-msg" style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.5rem"></p>';
        document.querySelectorAll("#module-visibility-card input[type=checkbox]").forEach(function(cb) {
          cb.addEventListener("change", async function() {
            var msg = document.getElementById("module-vis-msg");
            var studentData = {};
            var teacherData = {};
            document.querySelectorAll("#module-visibility-card input[type=checkbox]").forEach(function(c) {
              var role = c.getAttribute("data-role");
              var mod = c.getAttribute("data-mod");
              if (role === "student") studentData[mod] = c.checked;
              else teacherData[mod] = c.checked;
            });
            try {
              await request("/settings/modules", { method: "PUT", body: JSON.stringify({ student: studentData, teacher: teacherData }) });
              msg.textContent = "Saved"; msg.style.color = "var(--color-success)";
              setTimeout(function() { msg.textContent = ""; }, 2000);
            } catch(e) {
              msg.textContent = "Error: " + e.message; msg.style.color = "var(--color-danger)";
            }
          });
        });
      } catch(e) {
        loading.outerHTML = '<p style="color:var(--color-danger);font-size:0.85rem">Failed to load module settings</p>';
      }
    })();
  }
