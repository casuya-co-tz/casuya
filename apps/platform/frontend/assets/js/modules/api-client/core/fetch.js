// modules/api-client/core/fetch.js — request + SSE streaming helpers (shared global scope)

/* ── Request Function ──────────────────────────────────────────────────── */
async function request(path, options = {}) {
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

  let response = await fetch(url, fetchOptions);
  
  if (!response.ok) {
    if (response.status === 401 && !options._retry) {
      if (typeof refreshAuthToken === "function" && localStorage.getItem("casuya_refresh_token")) {
        try {
          const newToken = await refreshAuthToken();
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
    throw error;
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/* ── SSE Streaming Helper (P3-4) ─────────────────────────────────────── */
function streamTutorResponse(payload, onChunk, onDone, onError) {
  var token = localStorage.getItem("casuya_token");
  var headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;

  var controller = new AbortController();

  fetch(API_BASE + "/ai/tutoring/stream", {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).then(function(resp) {
    if (!resp.ok) throw new Error("Stream failed");
    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";

    function read() {
      reader.read().then(function(result) {
        if (result.done) {
          if (onDone) onDone();
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split("\n");
        buffer = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line.startsWith("data: ")) continue;
          try {
            var data = JSON.parse(line.substring(6));
            if (data.chunk) onChunk(data.chunk);
            if (data.done) { if (onDone) onDone(); return; }
          } catch (e) {}
        }
        read();
      }).catch(function(err) {
        if (err.name !== "AbortError" && onError) onError(err);
      });
    }
    read();
  }).catch(function(err) {
    if (err.name !== "AbortError" && onError) onError(err);
  });

  return controller;
}