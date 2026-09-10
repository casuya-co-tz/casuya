// Facade — actual implementation split into admin-branding.js, admin-analytics.js,
// admin-settings.js, admin-settings-platform.js
import "./admin-branding.js";
import "./admin-analytics.js";
import "./admin-settings-platform.js";
import "./admin-settings.js";

  // Load initial view from URL hash, fallback to dashboard
  const initialView = location.hash.slice(1) || "dashboard";
  if (navHandlers[initialView]) {
    navHandlers[initialView]();
  } else {
    loadAdminOverview();
  }
}
