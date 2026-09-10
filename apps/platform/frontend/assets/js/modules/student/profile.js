// modules/student/profile.js — profile editor (accessible from sidebar).

"use strict";

function registerProfileView(d) {
  async function showStudentProfileEditor() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading profile...</p></div>');
    try {
      const profile = await request("/students/me");
      d.showView(`
        <h2>Edit Profile</h2>
        <form id="profile-form" class="card" style="margin-top:1rem;display:flex;flex-direction:column;gap:0.75rem">
          <label>Full Name<input class="input" name="full_name" value="${escapeHtml(profile.full_name || "")}"></label>
          <label>Form Level
            <select class="input" name="form_level">
              ${["Form I","Form II","Form III","Form IV","Form V","Form VI"].map(f => `<option ${profile.form_level === f ? "selected" : ""}>${f}</option>`).join("")}
            </select>
          </label>
          <button class="btn btn-primary" type="submit">Save</button>
        </form>
      `);
      document.getElementById("profile-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await request("/students/me", { method: "PATCH", body: JSON.stringify({ full_name: fd.get("full_name"), form_level: fd.get("form_level") }) });
          showToast("Profile updated");
        } catch(err) { showToast("Error: " + err.message); }
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading profile</p></div>'); }
  }

  d.registerView("profile", showStudentProfileEditor);
}
