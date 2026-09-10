// modules/api-client/core/host.js — API host/protocol/base constants

const API_HOST = window.location.hostname || "localhost";

const API_PROTOCOL = (window.location.protocol === "http:" || window.location.protocol === "https:")
  ? window.location.protocol
  : "http:";

const API_BASE = window.casuyaApiBase ? window.casuyaApiBase()
  : (window.location.port === "8765" || window.location.port === "" || window.location.port === "443" || window.location.port === "80")
    ? window.location.origin
    : `${API_PROTOCOL}//${API_HOST}:8765`;

// Expose on window so ES modules (auth-guard.js loaded via <script type="module">)
// can also reach these when they import functions from auth-client.js.
window.API_HOST = API_HOST;
window.API_PROTOCOL = API_PROTOCOL;
window.API_BASE = API_BASE;