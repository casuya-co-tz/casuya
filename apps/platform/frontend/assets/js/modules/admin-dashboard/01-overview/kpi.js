// modules/admin-dashboard/01-overview/kpi.js — admin subjects & topics management

  async function loadAdminSubjects() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const subjects = await request("/subjects");
      const list = Array.isArray(subjects) ? subjects : [];
      showAdminView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>Subjects</h2>
            <button class="btn btn-primary" id="add-subject-btn">+ Add Subject</button>
          </div>
          <div id="form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No subjects yet</p></div>' :
              list.map(s => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h3>${escapeHtml(s.name)}</h3>
                      <p style="color:var(--color-text-muted);font-size:0.85rem">${escapeHtml(s.slug || "")}</p>
                    </div>
                    ${deleteBtn(s.id, s.name, "/subjects")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.getElementById("add-subject-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Subject</h3>
            <form id="create-subject-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <input class="input" name="name" placeholder="Subject name (e.g. Mathematics)" required>
              <input class="input" name="slug" placeholder="Slug (e.g. mathematics)" required>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-subject-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request("/subjects", { method: "POST", body: JSON.stringify({ name: fd.get("name"), slug: fd.get("slug") }) });
            loadAdminSubjects();
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          loadAdminTopics(card.dataset.id, card.dataset.name);
        });
      });
      initDeleteButtons();
    } catch (err) {
      showAdminView('<div class="empty-state"><h2>Error</h2><p>' + escapeHtml(err.message) + '</p></div>');
    }
  }

  async function loadAdminTopics(subjectId, subjectName) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading topics...</p></div>');
    try {
      const topics = await request(`/topics/${subjectId ? "?subject_id=" + subjectId : ""}`);
      const list = Array.isArray(topics) ? topics : [];
      showAdminView(`
        <div class="content">
          ${subjectId ? '<button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>' : ""}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${subjectId ? escapeHtml(subjectName) + " — " : ""}Topics</h2>
            <div style="display:flex;gap:0.5rem">
              <button class="btn" id="tpl-topics-btn">Template CSV</button>
              <button class="btn" id="bulk-topics-btn">Bulk Upload CSV</button>
              <button class="btn btn-primary" id="add-topic-btn">+ Add Topic</button>
            </div>
          </div>
          <div id="form-area"></div>
          <div id="bulk-result"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No topics yet</p></div>' :
              list.map(t => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(t.id)}" data-title="${escapeHtml(t.title)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h3>${escapeHtml(t.title)}</h3>
                      <p style="color:var(--color-text-muted);font-size:0.85rem">Form ${escapeHtml(t.form_level || "")}</p>
                    </div>
                    ${deleteBtn(t.id, t.title, "/topics")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      if (subjectId) document.getElementById("back-btn")?.addEventListener("click", loadAdminSubjects);
      document.getElementById("add-topic-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Topic</h3>
            <form id="create-topic-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              ${!subjectId ? '<select class="input" name="subject_id" required><option value="">Select subject...</option></select>' : ""}
              <input class="input" name="title" placeholder="Topic title" required>
              <select class="input" name="form_level">
                <option value="">Select form level...</option>
                ${["Form I","Form II","Form III","Form IV","Form V","Form VI"].map(f => '<option value="'+f+'">'+f+'</option>').join("")}
              </select>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        if (!subjectId) {
          request("/subjects").then(subs => {
            const sel = document.querySelector('[name="subject_id"]');
            if (sel && Array.isArray(subs)) subs.forEach(s => { const o = document.createElement("option"); o.value = s.id; o.textContent = s.name; sel.appendChild(o); });
          });
        }
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-topic-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const title = fd.get("title");
          const sid = subjectId || fd.get("subject_id");
          if (!title || !sid) { showToast("Title and subject are required"); return; }
          try {
            await request("/topics", { method: "POST", body: JSON.stringify({ title, subject_id: sid, form_level: fd.get("form_level") || "" }) });
            loadAdminTopics(subjectId, subjectName);
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.getElementById("tpl-topics-btn")?.addEventListener("click", () => {
        const csv = "subject_slug,form_level,title\nmathematics,Form II,Indices and Logarithms\nmathematics,Form II,Algebra\n";
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "topics_template.csv"; a.click();
        URL.revokeObjectURL(url);
      });
      document.getElementById("bulk-topics-btn")?.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file"; input.accept = ".csv,text/csv";
        input.addEventListener("change", async () => {
          const file = input.files?.[0];
          if (!file) return;
          const resEl = document.getElementById("bulk-result");
          if (resEl) resEl.innerHTML = '<div style="padding:0.5rem;font-size:0.85rem;color:var(--color-text-muted)">Uploading...</div>';
          const token = localStorage.getItem("casuya_token");
          const fd = new FormData();
          fd.append("file", file);
          try {
            const resp = await fetch(`${API_BASE}/topics/bulk`, { method: "POST", headers: token ? { "Authorization": `Bearer ${token}` } : {}, body: fd });
            const data = await resp.json();
            if (resp.ok) {
              const msg = `Created: ${data.created}, skipped (dup): ${data.skipped}, errors: ${data.error_count} (of ${data.total})`;
              if (resEl) resEl.innerHTML = `<div style="padding:0.5rem;background:#dcfce7;border-radius:var(--radius);font-size:0.85rem;color:var(--color-success)">${escapeHtml(msg)}</div>`;
              if (data.errors && data.errors.length) {
                const errs = data.errors.slice(0, 10).map(e => `Row ${e.row}: ${e.reason}`).join("<br>");
                if (resEl) resEl.innerHTML += `<div style="padding:0.5rem;background:#fee2e2;border-radius:var(--radius);font-size:0.8rem;color:var(--color-danger);margin-top:0.5rem">${errs}</div>`;
              }
              loadAdminTopics(subjectId, subjectName);
            } else {
              if (resEl) resEl.innerHTML = `<div style="padding:0.5rem;background:#fee2e2;border-radius:var(--radius);font-size:0.85rem;color:var(--color-danger)">${escapeHtml(data.detail || "Upload failed")}</div>`;
            }
          } catch (err) {
            if (resEl) resEl.innerHTML = `<div style="padding:0.5rem;background:#fee2e2;border-radius:var(--radius);font-size:0.85rem;color:var(--color-danger)">${escapeHtml(err.message)}</div>`;
          }
        });
        input.click();
      });
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          loadAdminSubtopics(card.dataset.id, card.dataset.title, loadAdminTopics.bind(null, subjectId, subjectName));
        });
      });
      initDeleteButtons();
    } catch (err) {
      showAdminView('<div class="empty-state"><h2>Error</h2><p>' + escapeHtml(err.message) + '</p></div>');
    }
  }