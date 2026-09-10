  async function loadAdminBranding() {
    const API = window.casuyaApiBase ? window.casuyaApiBase() : ((window.location.port === "8765" || window.location.port === "" || window.location.port === "443" || window.location.port === "80") ? window.location.origin : `${window.location.protocol}//${window.location.hostname}:8765`);
    const token = localStorage.getItem("casuya_token");
    const headers = token ? { "Authorization": `Bearer ${token}` } : {};

    // Check what's currently uploaded
    let logoExists = false, faviconExists = false;
    const [lr, fr] = await Promise.all([
      fetch(`${API}/branding/logo`).catch(() => ({ ok: false })),
      fetch(`${API}/branding/favicon`).catch(() => ({ ok: false }))
    ]);
    logoExists = lr.ok;
    faviconExists = fr.ok;

    showAdminView(`
      <div class="content">
        <h2>🎨 Site Branding</h2>
        <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:1.5rem">Upload your logo and favicon. These appear across the entire platform.</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
          <!-- Logo -->
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">🖼️ Logo</h3>
            <div style="text-align:center;margin-bottom:1rem">
              ${logoExists
                ? `<img src="${API}/branding/logo" alt="Current logo" style="max-width:120px;max-height:120px;border-radius:12px;border:1px solid var(--color-border)">`
                : `<div style="width:120px;height:120px;margin:0 auto;background:linear-gradient(135deg,var(--color-primary),#7c3aed);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:2rem;font-weight:800">C</div>`
              }
              <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.5rem">${logoExists ? "✅ Custom logo active" : "Using default"}</p>
            </div>
            <form id="logo-upload-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <input class="input" type="file" id="logo-file" accept="image/*" required />
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-success btn-pattern" type="submit" style="flex:1">${logoExists ? "🔄 Replace" : "📤 Upload"}</button>
                ${logoExists ? '<button class="btn btn-outline-danger btn-sm" type="button" id="logo-delete">🗑️ Delete</button>' : ''}
              </div>
            </form>
            <div id="logo-result" style="margin-top:0.5rem;font-size:0.8rem"></div>
          </div>

          <!-- Favicon -->
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">🏷️ Favicon</h3>
            <div style="text-align:center;margin-bottom:1rem">
              ${faviconExists
                ? `<img src="${API}/branding/favicon" alt="Current favicon" style="width:64px;height:64px;border-radius:8px;border:1px solid var(--color-border)">`
                : `<div style="width:64px;height:64px;margin:0 auto;background:linear-gradient(135deg,var(--color-primary),#7c3aed);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.2rem;font-weight:800">C</div>`
              }
              <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.5rem">${faviconExists ? "✅ Custom favicon active" : "Using default"}</p>
            </div>
            <form id="favicon-upload-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <input class="input" type="file" id="favicon-file" accept="image/*" required />
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-success btn-pattern" type="submit" style="flex:1">${faviconExists ? "🔄 Replace" : "📤 Upload"}</button>
                ${faviconExists ? '<button class="btn btn-outline-danger btn-sm" type="button" id="favicon-delete">🗑️ Delete</button>' : ''}
              </div>
            </form>
            <div id="favicon-result" style="margin-top:0.5rem;font-size:0.8rem"></div>
          </div>
        </div>
      </div>
    `);

    // Logo upload
    document.getElementById("logo-upload-form")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const file = document.getElementById("logo-file")?.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        const r = await fetch(`${API}/branding/logo`, { method: "POST", headers, body: fd });
        const d = await r.json();
        if (r.ok) {
          document.getElementById("logo-result").innerHTML = '<span style="color:var(--color-success)">Logo uploaded!</span>';
          localStorage.removeItem("casuya_brand_logo");
          loadAdminBranding();
        } else {
          document.getElementById("logo-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(d.detail || "Failed")}</span>`;
        }
      } catch (e) {
        document.getElementById("logo-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(e.message)}</span>`;
      }
    });

    // Logo delete
    document.getElementById("logo-delete")?.addEventListener("click", async () => {
      try {
        await fetch(`${API}/branding/logo`, { method: "DELETE", headers });
        localStorage.removeItem("casuya_brand_logo");
        loadAdminBranding();
      } catch {}
    });

    // Favicon upload
    document.getElementById("favicon-upload-form")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const file = document.getElementById("favicon-file")?.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        const r = await fetch(`${API}/branding/favicon`, { method: "POST", headers, body: fd });
        const d = await r.json();
        if (r.ok) {
          document.getElementById("favicon-result").innerHTML = '<span style="color:var(--color-success)">Favicon uploaded!</span>';
          localStorage.removeItem("casuya_brand_favicon");
          loadAdminBranding();
        } else {
          document.getElementById("favicon-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(d.detail || "Failed")}</span>`;
        }
      } catch (e) {
        document.getElementById("favicon-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(e.message)}</span>`;
      }
    });

    // Favicon delete
    document.getElementById("favicon-delete")?.addEventListener("click", async () => {
      try {
        await fetch(`${API}/branding/favicon`, { method: "DELETE", headers });
        localStorage.removeItem("casuya_brand_favicon");
        loadAdminBranding();
      } catch {}
    });
  }
