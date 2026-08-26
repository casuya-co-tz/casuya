// Shared auth UI helpers for the marketing/auth pages (index, login, register).
// Single source of truth so the entry-point experience never contradicts
// the role-based portals (which live under /admin, /teacher, /student and
// enforce their own guards).

import { getStoredAuth, getPortalPath, clearAuth } from "./auth-client.js";

const PORTAL_LABELS = {
  admin: "Admin Dashboard",
  teacher: "Teacher Portal",
  student: "Student Portal",
};

function decodeTokenRole(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  const auth = getStoredAuth();
  if (!auth.accessToken || !auth.role) return false;
  return decodeTokenRole(auth.accessToken) !== null;
}

// If the visitor is already signed in, send them straight to their portal.
// Used by login/register so an authenticated user never sees the auth form.
export function redirectIfAuthed() {
  const auth = getStoredAuth();
  if (auth.accessToken && auth.role) {
    const decodedRole = decodeTokenRole(auth.accessToken);
    if (decodedRole) {
      window.location.replace(getPortalPath(decodedRole));
      return true;
    }
    clearAuth();
  }
  return false;
}

// Render auth-aware navigation buttons into the given container element.
// When signed in: a "Dashboard" button (role-specific) + "Log out".
// When signed out: "Login" + "Get Started".
export function applyAuthChrome(container) {
  if (!container) return;
  const auth = getStoredAuth();
  if (auth.accessToken && auth.role) {
    const label = PORTAL_LABELS[auth.role] || "Dashboard";
    container.innerHTML = `
      <a href="${getPortalPath(auth.role)}" class="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors">${label}</a>
      <button type="button" id="auth-logout-btn" class="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-slate-100 transition-all hover:-translate-y-0.5">Log out</button>
    `;
    container.querySelector("#auth-logout-btn")?.addEventListener("click", () => {
      clearAuth();
      window.location.replace("/index.html#features");
    });
  } else {
    container.innerHTML = `
      <a href="/login.html" class="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors">Login</a>
      <a href="/register.html" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-100 transition-all hover:-translate-y-0.5">Get Started</a>
    `;
  }
}
