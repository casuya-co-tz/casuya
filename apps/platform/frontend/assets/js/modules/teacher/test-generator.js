// modules/teacher/test-generator.js — Test Generator view for the teacher dashboard.

function loadTeacherTestGenerator(dashboard) {
  dashboard.showView(renderTestGeneratorView({
    title: "Test Generator",
    intro: "Build practice tests for your class grounded in the NECTA/TIE knowledge base. Pick an exam type (Topical, Monthly, Midterm, Terminal, Annual, or NECTA Form II/IV/VI), then choose the subject, form, and topic.",
  }));
  initTestGeneratorView(document.getElementById("teacher-content"));
}