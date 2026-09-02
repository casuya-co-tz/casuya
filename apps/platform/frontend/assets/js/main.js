// main.js — bootstrap/glue. Loaded AFTER modules/*.js (classic scripts, shared global scope).
// Derive the API base the same way auth-client.js does: when the page is
// served from the API host (port 8765) use same-origin, otherwise assume the
// backend runs on :8765. This keeps dev (separate frontend port) and a
// reverse-proxied production deploy behaviour consistent.
// --- Login ---
// --- App Router ---
// --- Student Dashboard ---
// --- Admin Dashboard ---
// --- Teacher Dashboard ---
document.addEventListener("DOMContentLoaded", async () => {
  applyAppearance();
  const token = localStorage.getItem("casuya_token");
  if (token) {
    try {
      const data = await request("/settings/maintenance");
      if (data && data.enabled === true && localStorage.getItem("casuya_role") !== "admin") {
        renderMaintenanceScreen(data);
        return;
      }
    } catch (_) {}
    renderApp();
  } else {
    renderLogin();
  }
});

function renderMaintenanceScreen(data) {
  var app = document.getElementById("app");
  if (app) app.style.visibility = "hidden";
  if (document.getElementById("casuya-maintenance")) return;
  var fmt = data.until ? new Date(data.until) : null;
  var whenHtml = "";
  if (fmt && !isNaN(fmt.getTime())) {
    var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    var whenText = days[fmt.getDay()] + ", " + months[fmt.getMonth()] + " " + fmt.getDate() + (fmt.getHours()||fmt.getMinutes() ? " at " + (fmt.getHours()%12||12) + ":" + (fmt.getMinutes()<10?"0":"") + fmt.getMinutes() + (fmt.getHours()>=12?" PM":" AM") : "");
    whenHtml = '<p style="margin:1.25rem 0 0;font-size:1rem;color:rgba(255,255,255,0.92);font-weight:600">' + "We should be back by <span style='border-bottom:2px solid rgba(255,255,255,0.55)'>&nbsp;" + whenText + "&nbsp;</span></p>";
  }
  var overlay = document.createElement("div");
  overlay.id = "casuya-maintenance";
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:linear-gradient(140deg,#1e3a8a 0%,#2563eb 55%,#3b82f6 100%);color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;overflow:auto";
  overlay.innerHTML = '<div style="max-width:560px;width:100%">'
    + '<div style="width:56px;height:56px;margin:0 auto 1.25rem;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.15);border-radius:16px;font-size:1.7rem">🔧</div>'
    + '<h1 style="margin:0 0 0.75rem;font-size:1.85rem;line-height:1.2;font-weight:800">' + (data.title || "We'll Be Back Soon") + '</h1>'
    + '<p style="margin:0 auto;font-size:1.05rem;line-height:1.7;color:rgba(255,255,255,0.92);max-width:460px">' + (data.message || "We're making a few careful improvements to Casuya to serve you even better. Your learning progress is safe with us — hang tight, we're almost ready to welcome you back.") + '</p>'
    + whenHtml
    + '<p style="margin:1.5rem 0 0;font-size:0.85rem;color:rgba(255,255,255,0.7)">Thank you for your patience — see you very soon. 💙</p>'
    + '</div>';
  document.body.appendChild(overlay);
}
