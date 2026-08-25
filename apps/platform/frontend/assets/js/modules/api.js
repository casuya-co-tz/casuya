// modules/api.js — extracted from main.js (classic script, shared global scope)
const API_HOST = window.location.hostname || "localhost";

const API_PROTOCOL = (window.location.protocol === "http:" || window.location.protocol === "https:")
  ? window.location.protocol
  : "http:";

const API_BASE = window.casuyaApiBase ? window.casuyaApiBase()
  : (window.location.port === "8765" || window.location.port === "" || window.location.port === "443" || window.location.port === "80")
    ? window.location.origin
    : `${API_PROTOCOL}//${API_HOST}:8765`;

function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return {};
  }
}

const requestCache = new Map();

const inFlight = new Map();

const CACHE_TTL = 30000;

async function request(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const cacheKey = `${method}:${path}`;

  if (method === "GET") {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    if (inFlight.has(cacheKey)) {
      return inFlight.get(cacheKey);
    }
  } else {
    requestCache.clear();
  }

  const doFetch = async () => {
    const token = localStorage.getItem("casuya_token");
    const headers = { "Content-Type": "application/json", ...options.headers };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
      try {
        let fetchUrl = `${API_BASE}${path}`;
        const resp = await fetch(fetchUrl, { ...options, headers });
        if (resp.status === 401) {
          if (!options._retried) {
            try {
              const newToken = await refreshAuthToken();
              headers["Authorization"] = `Bearer ${newToken}`;
              const retryResp = await fetch(fetchUrl, { ...options, headers, _retried: true });
              if (retryResp.status === 401) throw new Error("Session expired. Please sign in again.");
              if (!retryResp.ok) {
                const err = await retryResp.json().catch(() => ({ detail: retryResp.statusText }));
                throw new Error(err.detail || "Request failed");
              }
              const retryData = await retryResp.json();
              if (method === "GET") requestCache.set(cacheKey, { data: retryData, timestamp: Date.now() });
              return retryData;
            } catch (refreshErr) {
              localStorage.removeItem("casuya_token");
              localStorage.removeItem("casuya_refresh_token");
              renderLogin();
              return null;
            }
          }
          localStorage.removeItem("casuya_token");
          localStorage.removeItem("casuya_refresh_token");
          renderLogin();
          return null;
        }
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: resp.statusText }));
          if (resp.status >= 500 && attempt < 2) continue;
          throw new Error(err.detail || "Request failed");
        }
        const data = await resp.json();
        if (method === "GET") {
          requestCache.set(cacheKey, { data, timestamp: Date.now() });
        }
        return data;
      } catch (err) {
        lastErr = err;
        if ((err.name !== "TypeError" && err.name !== "SyntaxError") || attempt >= 2) break;
      }
    }
    throw lastErr;
  };

  const promise = doFetch().finally(() => inFlight.delete(cacheKey));
  if (method === "GET") {
    inFlight.set(cacheKey, promise);
  }
  return promise;
}

async function refreshAuthToken() {
  const refreshToken = localStorage.getItem("casuya_refresh_token");
  if (!refreshToken) throw new Error("No refresh token");
  const resp = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!resp.ok) throw new Error("Refresh failed");
  const data = await resp.json();
  if (data.access_token) localStorage.setItem("casuya_token", data.access_token);
  if (data.refresh_token) localStorage.setItem("casuya_refresh_token", data.refresh_token);
  return data.access_token;
}

let _globalAbort = null;

function render(container, html) {
  const el = typeof container === "string" ? document.querySelector(container) : container;
  if (!el) return;
  if (_globalAbort) {
    const old = _globalAbort;
    Promise.resolve().then(() => old.abort());
  }
  _globalAbort = new AbortController();
  el.innerHTML = html;
}

function escapeHtml(str) {
  if (str == null) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + "d ago";
  return new Date(timestamp).toLocaleDateString();
}

function showToast(msg) {
  let t = document.getElementById("global-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "global-toast";
    t.style.cssText = "position:fixed;bottom:1.5rem;right:1.5rem;padding:0.6rem 1.2rem;background:var(--color-success);color:#fff;border-radius:var(--radius);font-size:0.85rem;z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t._hide);
  t._hide = setTimeout(() => { t.style.opacity = "0"; }, 2500);
}

function confirmDelete(label) {
  return confirm(`Delete "${label}"? This cannot be undone.`);
}

function deleteBtn(id, label, endpoint, onDone) {
  return `<button class="btn btn-danger btn-sm" data-delete="${id}" data-label="${escapeHtml(label)}" data-endpoint="${endpoint}">Delete</button>`;
}

function initDeleteButtons() {
  document.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.delete;
      const label = btn.dataset.label;
      const endpoint = btn.dataset.endpoint;
      if (!confirmDelete(label)) return;
      try {
        await request(`${endpoint}/${id}`, { method: "DELETE" });
        showToast("Deleted!");
        btn.closest(".card")?.remove();
      } catch(err) { showToast(err.message || "Delete failed"); }
    });
  });
}
