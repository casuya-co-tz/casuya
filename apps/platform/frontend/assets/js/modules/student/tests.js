// modules/student/tests.js — Test Generator view for the student dashboard.

function loadStudentTestGenerator(dashboard) {
  dashboard.showView(renderTestGeneratorView({
    title: "Test Generator",
    intro: "Pick an exam type (Topical, Monthly, Midterm, Terminal, Annual, or NECTA Form II/IV/VI), choose your subject and topic, then practice fresh questions grounded in the NECTA/TIE knowledge base.",
  }));
  initTestGeneratorView(document.getElementById("student-content"));
}

function registerTestsView(dashboard) {
  dashboard.registerView("test-generator", () => {
    dashboard.setActiveNav("test-generator");
    loadStudentTestGenerator(dashboard);
  });
}