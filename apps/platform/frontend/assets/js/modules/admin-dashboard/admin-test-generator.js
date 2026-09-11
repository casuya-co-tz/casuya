// modules/admin-dashboard/admin-test-generator.js — Test Generator view for the admin dashboard.

function loadAdminTestGenerator() {
  showAdminView(renderTestGeneratorView({
    title: "Test Generator",
    intro: "Generate platform-wide practice tests grounded in the NECTA/TIE knowledge base. Pick an exam type (Topical, Monthly, Midterm, Terminal, Annual, or NECTA Form II/IV/VI), then choose the subject, form, and topic.",
  }));
  initTestGeneratorView(document.getElementById("admin-content"));
}