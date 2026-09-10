// modules/student/subjects.js — subject/topic/subtopic browser.
//
// Handles the three-level drill-down: subjects → topics → subtopics → lessons.
// Also includes loadSubtopicLessons which bridges to the lessons view.

"use strict";

function registerSubjectsView(d) {
  async function loadStudentSubjects() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const subjects = await request("/subjects");
      const filtered = Array.isArray(subjects) ? subjects : [];
      if (filtered.length === 0) {
        d.showView('<div class="empty-state"><p>No subjects found</p></div>');
        return;
      }
      d.showView(`
        <h2>Subjects</h2>
        <div class="card-grid" style="margin-top:1rem">
          ${filtered.map(s => `
            <div class="card subject-card" data-id="${s.id}" style="cursor:pointer">
              <h3>${escapeHtml(s.name)}</h3>
              <p style="color:var(--color-text-muted)">${escapeHtml(s.slug || "")}</p>
            </div>
          `).join("")}
        </div>
      `);
      document.querySelectorAll(".subject-card").forEach(card => {
        card.addEventListener("click", () => d.callView("subject-topics", card.dataset.id));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading subjects</p></div>'); }
  }

  async function loadSubjectTopics(subjectId) {
    d._navStack.push(() => d.callView("subjects"));
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading topics...</p></div>');
    try {
      const topics = await request("/topics?subject_id=" + encodeURIComponent(subjectId));
      const formFilter = localStorage.getItem("casuya_form_filter") || "";
      let filtered = Array.isArray(topics) ? topics : [];
      if (formFilter) {
        const ff = formFilter.replace(/^Form /, "");
        filtered = filtered.filter(t => !t.form_level || t.form_level === formFilter || t.form_level.replace(/^Form /, "") === ff);
      }
      if (filtered.length === 0) {
        d.showView('<div class="empty-state"><p>No topics found</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", () => d.goBack());
        return;
      }
      d.showView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2>Topics</h2>
        </div>
        <div class="card-grid">
          ${filtered.map(t => `
            <div class="card topic-card" data-id="${t.id}" style="cursor:pointer">
              <h3>${escapeHtml(t.title)}</h3>
            </div>
          `).join("")}
        </div>
      `);
      document.getElementById("back-btn").addEventListener("click", () => d.goBack());
      document.querySelectorAll(".topic-card").forEach(card => {
        card.addEventListener("click", () => d.callView("topic-subtopics", card.dataset.id, subjectId));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading topics</p></div>'); }
  }

  async function loadTopicSubtopics(topicId, subjectId) {
    d._navStack.push(() => d.callView("subject-topics", subjectId));
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading subtopics...</p></div>');
    try {
      const subtopics = await request("/subtopics?topic_id=" + encodeURIComponent(topicId));
      const filtered = Array.isArray(subtopics) ? subtopics : [];
      if (filtered.length === 0) {
        d.showView('<div class="empty-state"><p>No subtopics found</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", () => d.goBack());
        return;
      }
      d.showView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2>Subtopics</h2>
        </div>
        <div class="card-grid">
          ${filtered.map(s => `
            <div class="card subtopic-card" data-id="${s.id}" style="cursor:pointer">
              <h3>${escapeHtml(s.title)}</h3>
            </div>
          `).join("")}
        </div>
      `);
      document.getElementById("back-btn").addEventListener("click", () => d.goBack());
      document.querySelectorAll(".subtopic-card").forEach(card => {
        card.addEventListener("click", () => d.callView("subtopic-lessons", card.dataset.id, topicId, subjectId));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading subtopics</p></div>'); }
  }

  async function loadSubtopicLessons(subtopicId, topicId, subjectId) {
    d._navStack.push(() => d.callView("topic-subtopics", topicId, subjectId));
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading lessons...</p></div>');
    try {
      const lessons = await request("/lessons/?subtopic_id=" + encodeURIComponent(subtopicId) + "&status=published");
      const filtered = Array.isArray(lessons) ? lessons : [];
      d._subtopicLessonList = filtered;
      if (filtered.length === 0) {
        d.showView('<div class="empty-state"><p>No lessons found</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", () => d.goBack());
        return;
      }
      d.showView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2>Lessons</h2>
        </div>
        <div class="card-grid">
          ${filtered.map(l => `
            <div class="card lesson-card" data-id="${l.id}" style="cursor:pointer">
              <h3>${escapeHtml(l.title)}</h3>
              <p style="color:var(--color-text-muted);font-size:0.85rem">${escapeHtml(l.status || "")}</p>
            </div>
          `).join("")}
        </div>
      `);
      document.getElementById("back-btn").addEventListener("click", () => d.goBack());
      document.querySelectorAll(".lesson-card").forEach(card => {
        card.addEventListener("click", () => d.callView("lesson", card.dataset.id));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading lessons</p></div>'); }
  }

  d.registerView("subjects", loadStudentSubjects);
  d.registerView("subject-topics", loadSubjectTopics);
  d.registerView("topic-subtopics", loadTopicSubtopics);
  d.registerView("subtopic-lessons", loadSubtopicLessons);
}
