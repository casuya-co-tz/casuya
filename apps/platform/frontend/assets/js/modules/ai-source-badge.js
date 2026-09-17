// ai-source-badge.js — show whether a response came from casuya-ai or offline fallback.

function renderAiSourceBadge(source) {
  if (!source) return "";
  var label = source === "casuya-ai" ? "Powered by AI" : "Offline mode";
  var tone = source === "casuya-ai" ? "var(--color-primary, #2563eb)" : "var(--color-text-muted, #64748b)";
  return (
    '<span class="ai-source-badge" style="display:inline-block;margin-top:0.5rem;font-size:0.75rem;' +
    "color:" + tone + ';font-weight:600;" title="Response source: ' + escapeHtml(String(source)) + '">' +
    escapeHtml(label) +
    "</span>"
  );
}
