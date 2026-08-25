const API_HOST = window.location.hostname || "localhost";
const API_PROTOCOL = window.location.protocol === "http:" || window.location.protocol === "https:"
  ? window.location.protocol
  : "http:";
const API_BASE = (window.casuyaApiBase
  ? window.casuyaApiBase()
  : `${API_PROTOCOL}//${API_HOST || "localhost"}:8765`);

const STORAGE_KEYS = {
  accessToken: "casuya_token",
  refreshToken: "casuya_refresh_token",
  userId: "casuya_user_id",
  role: "casuya_role",
};

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildApiUrl(path, method = "GET") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const [pathname, search = ""] = normalizedPath.split("?");
  return `${API_BASE}${pathname}${search ? `?${search}` : ""}`;
}

function getAuthHeaders(headers = {}, includeJson = true) {
  const nextHeaders = { ...headers };
  const accessToken = getAccessToken();

  if (includeJson && !nextHeaders["Content-Type"]) {
    nextHeaders["Content-Type"] = "application/json";
  }

  if (accessToken && !nextHeaders.Authorization) {
    nextHeaders.Authorization = `Bearer ${accessToken}`;
  }

  return nextHeaders;
}

export function getApiBase() {
  return API_BASE;
}

export function getPortalPath(role) {
  if (role === "admin") return "/admin/";
  if (role === "teacher") return "/teacher/";
  return "/student/";
}

export function getStoredAuth() {
  return {
    accessToken: localStorage.getItem(STORAGE_KEYS.accessToken),
    refreshToken: localStorage.getItem(STORAGE_KEYS.refreshToken),
    userId: localStorage.getItem(STORAGE_KEYS.userId),
    role: localStorage.getItem(STORAGE_KEYS.role),
  };
}

export function getAccessToken() {
  return localStorage.getItem(STORAGE_KEYS.accessToken);
}

export function getRefreshToken() {
  return localStorage.getItem(STORAGE_KEYS.refreshToken);
}

export function persistAuth(data) {
  if (data.access_token) {
    localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
  }
  if (data.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
  }
  if (data.user_id) {
    localStorage.setItem(STORAGE_KEYS.userId, data.user_id);
  }
  if (data.role) {
    localStorage.setItem(STORAGE_KEYS.role, data.role);
  }
}

export function clearAuth() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

export function redirectToPortal(role) {
  window.location.replace(getPortalPath(role));
}

export function redirectToLogin() {
  window.location.replace("/login.html");
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const response = await fetch(buildApiUrl("/auth/refresh", "POST"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const data = safeJsonParse(await response.text()) || {};

  if (!response.ok || !data.access_token) {
    clearAuth();
    throw new Error(data.detail || "Session expired. Please sign in again.");
  }

  persistAuth(data);
  return data.access_token;
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = getAuthHeaders(options.headers, !isFormData);

  const response = await fetch(buildApiUrl(path, method), {
    ...options,
    method,
    headers,
  });

  if (response.status === 401 && options.retryOnAuthFailure !== false && getRefreshToken()) {
    try {
      await refreshAccessToken();
      return apiRequest(path, { ...options, retryOnAuthFailure: false });
    } catch (error) {
      clearAuth();
      throw error;
    }
  }

  const text = await response.text();
  const data = safeJsonParse(text);

  if (!response.ok) {
    if (response.status === 401) {
      clearAuth();
      throw new Error(data?.detail || "Session expired. Please sign in again.");
    }
    throw new Error(data?.detail || response.statusText || "Request failed");
  }

  return data ?? text;
}

export async function login({ email, password }) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    retryOnAuthFailure: false,
  });

  persistAuth(data);
  return data;
}

export function requireRole(expectedRole) {
  const auth = getStoredAuth();

  if (!auth.accessToken || !auth.role) {
    clearAuth();
    redirectToLogin();
    return null;
  }

  if (expectedRole && auth.role !== expectedRole) {
    redirectToPortal(auth.role);
    return null;
  }

  return auth;
}
