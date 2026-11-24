// modules/api-client/core/fetch.js — request + SSE streaming helpers (shared global scope)

function asProgressItems(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

/* ── Request Function ──────────────────────────────────────────────────── */
async function request(path, options = {}) {
  const cached = typeof getCachedRequest === "function" ? getCachedRequest(path, options) : null;
  if (cached !== null && cached !== undefined) return cached;

  const pending = typeof getInFlightRequest === "function" ? getInFlightRequest(path, options) : null;
  if (pending) return pending;

  let token = localStorage.getItem("casuya_token");

  if (token && !options._retry && typeof tokenNeedsRefresh === "function" && tokenNeedsRefresh(token) && localStorage.getItem("casuya_refresh_token")) {
    try {
      token = await refreshAuthToken();
    } catch (err) {
      localStorage.removeItem("casuya_token");
      localStorage.removeItem("casuya_refresh_token");
      window.location.replace("/login.html");
      throw err;
    }
  }

  const method = (options.method || "GET").toUpperCase();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = "Bearer " + token;

  const url = API_BASE + path;
  const fetchOptions = { method, headers };
  if (options.body) fetchOptions.body = options.body;

  const run = (async () => {
    let response = await fetch(url, fetchOptions);

    if (!response.ok) {
      if (response.status === 401 && !options._retry) {
        if (typeof refreshAuthToken === "function" && localStorage.getItem("casuya_refresh_token")) {
          try {
            await refreshAuthToken();
            options._retry = true;
            return await request(path, options);
          } catch (err) {
            localStorage.removeItem("casuya_token");
            window.location.replace("/login.html");
            throw err;
          }
        } else {
          localStorage.removeItem("casuya_token");
          window.location.replace("/login.html");
        }
      }

      const error = new Error(response.statusText || "Request failed");
      error.status = response.status;
      try {
        const body = await response.json();
        if (body && typeof body.detail === "string" && body.detail) {
          error.message = body.detail;
        }
      } catch (e) {}
      throw error;
    }

    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    if (typeof setCachedRequest === "function") setCachedRequest(path, options, parsed);
    return parsed;
  })();

  if (typeof setInFlightRequest === "function") setInFlightRequest(path, options, run);
  try {
    return await run;
  } finally {
    if (typeof clearInFlightRequest === "function") clearInFlightRequest(path, options);
  }
}
