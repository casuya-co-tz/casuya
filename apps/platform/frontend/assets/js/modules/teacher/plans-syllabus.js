// modules/teacher/plans-syllabus.js — teaching documents: curriculum data & syllabus topic loading
// Extracted from plans.js (classic script, shared global scope).

const plansSubjects = [
  { slug: "mathematics", name: "Mathematics", sw: false },
  { slug: "chemistry", name: "Chemistry", sw: false },
  { slug: "physics", name: "Physics", sw: false },
];
const plansRoman = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI" };
const plansTermNames = { "Term 1": "Term I", "Term 2": "Term II" };
const plansTermNamesSw = { "Term 1": "Muhtasari wa Kwanza", "Term 2": "Muhtasari wa Pili" };

function plansSubjectOptions() {
  return plansSubjects.map(s => `<option value="${s.slug}">${escapeHtml(s.name)}${s.sw ? " (Kiswahili)" : ""}</option>`).join("");
}

function plansIsSwSubject(slug) {
  return plansSubjects.find(s => s.slug === slug)?.sw || false;
}

function plansPlanLabel(p) {
  if (p.plan_type === "scheme_of_work") {
    const tn = p.language === "sw" ? (plansTermNamesSw[p.term] || p.term) : (plansTermNames[p.term] || p.term);
    return `${p.title}`;
  }
  return p.title;
}

async function plansLoadSyllabusTopics() {
  const ss = document.getElementById("tdoc-ss")?.value;
  const formLevel = document.querySelector("#tdoc-lesson-form [name=form_level]")?.value;
  const topicSel = document.getElementById("tdoc-topic");
  const subSel = document.getElementById("tdoc-subtopic");
  if (!topicSel) return;
  topicSel.innerHTML = '<option value="">Loading topics…</option>';
  subSel.innerHTML = '<option value="">— choose a topic first —</option>';
  if (!ss || !formLevel) { topicSel.innerHTML = '<option value="">— choose subject & form to load topics —</option>'; return; }
  let topics = [];
  try {
    const res = await request(`/syllabus/subjects/${encodeURIComponent(ss)}/forms/${formLevel}?_t=${Date.now()}`);
    topics = (res && Array.isArray(res.topics)) ? res.topics : [];
  } catch(e) { topics = []; }
  if (!topics.length) { topicSel.innerHTML = '<option value="">No syllabus topics found</option>'; return; }
  topicSel.innerHTML = '<option value="">— select a topic —</option>' + topics.map(t => {
    const code = t.code ? `${t.code} ` : "";
    const subs = (t.subtopics || []).map(s => ({ title: s.title, code: s.code || "" }));
    const subJson = escapeHtml(JSON.stringify(subs)).replace(/"/g, "&quot;");
    return `<option value="${escapeHtml(t.title)}" data-subtopics="${subJson}">${escapeHtml(code + t.title)}</option>`;
  }).join("");
}

function plansLoadSubtopicOptions() {
  const topicSel = document.getElementById("tdoc-topic");
  const subSel = document.getElementById("tdoc-subtopic");
  if (!subSel || !topicSel) return;
  subSel.innerHTML = '<option value="">— select a topic first —</option>';
  const chosen = topicSel.value;
  if (!chosen) return;
  const option = Array.from(topicSel.options).find(o => o.value === chosen);
  const subtopics = option ? (option.dataset.subtopics ? JSON.parse(option.dataset.subtopics) : []) : [];
  subSel.innerHTML = '<option value="">— select a subtopic —</option>' + subtopics.map(s => {
    const code = s.code ? `${s.code} ` : "";
    return `<option value="${escapeHtml(s.title)}">${escapeHtml(code + s.title)}</option>`;
  }).join("");
}