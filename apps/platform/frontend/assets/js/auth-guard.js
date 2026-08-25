// Shared client-side role guard for the role-specific portals.
// Redirects unauthenticated users to login and users with the wrong role
// to their own portal, then signals the host page that the guard passed.

const ROLE_PORTALS = {
  admin: "/admin/",
  teacher: "/teacher/",
  student: "/student/",
};

function decodeTokenRole(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

export function guardPortal(expectedRole) {
  const token = localStorage.getItem("casuya_token");
  if (!token) {
    window.location.replace("/login.html");
    return false;
  }
  const role = decodeTokenRole(token);
  if (!role) {
    window.location.replace("/login.html");
    return false;
  }
  if (role !== expectedRole) {
    const target = ROLE_PORTALS[role] || "/login.html";
    window.location.replace(target);
    return false;
  }
  return true;
}
