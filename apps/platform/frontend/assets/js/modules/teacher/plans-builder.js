// modules/teacher/plans-builder.js — teaching documents: generated document build/preview/export/save
// Extracted from plans.js (classic script, shared global scope).

let plansLastGenHtml = "";
function plansSetLastGenHtml(h) { plansLastGenHtml = h || ""; }
function plansGetLastGenHtml() { return plansLastGenHtml; }

async function plansViewDocument(id) {
  const detail = await request(`/teacher-plans/${id}?_t=${Date.now()}`).catch(() => null);
  if (!detail) { alert("Could not load document"); return; }
  const win = window.open("", "_blank", "width=1100,height=750");
  if (win) { win.document.write(detail.html_render || "<p>No preview</p>"); win.document.close(); }
  else { alert("Popup blocked. Please allow popups to preview."); }
}

async function plansPrintDocument(id) {
  const detail = await request(`/teacher-plans/${id}?_t=${Date.now()}`).catch(() => null);
  if (!detail) { alert("Could not load document"); return; }
  const win = window.open("", "_blank", "width=1100,height=750");
  if (win) { win.document.write(detail.html_render || "<p>No preview</p>"); win.document.close(); win.focus(); setTimeout(()=>win.print(), 400); }
  else { alert("Popup blocked. Please allow popups."); }
}

function plansBuildWordHtml(html) {
  let doc = null;
  try { doc = new DOMParser().parseFromString(html || "", "text/html"); } catch(e) { doc = null; }
  if (!doc || !doc.body || doc.querySelector("parsererror")) return html || "";
  const body = doc.body.cloneNode(true);
  body.querySelectorAll("script,iframe,.actions,.no-print").forEach(n => { if (n.parentNode) n.parentNode.removeChild(n); });
  let styles = "";
  doc.querySelectorAll("head style").forEach(s => { if (s.textContent) styles += s.textContent + "\n"; });
  styles = styles.replace(/@import[^;]+;\s*/g, "");
  const wordMeta = '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotExpandShiftReturn/></w:WordDocument></xml><![endif]-->';
  const wordCss = (styles || "") +
    'body{margin:14pt 16pt;font-family:"Calibri","Segoe UI",Arial,sans-serif;font-size:9pt;color:#1e293b;line-height:1.4}' +
    'table{border-collapse:collapse;width:100%}th,td{border:1px solid #e2e8f0;padding:4px 5px;vertical-align:top}' +
    'th{background:#f1f5f9;font-weight:700}thead{display:table-header-group}tr{page-break-inside:avoid}' +
    '.actions,.no-print{display:none}@page{size:A4 portrait;margin:12mm 10mm 12mm 10mm}';
  return '<!DOCTYPE html>\n<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">\n' +
    '<head><meta charset="UTF-8">' + wordMeta + '\n' +
    `<title>${(doc.title || "Casuya Document")}</title>` + '\n' +
    `<style>${wordCss}</style>\n</head>\n<body>\n${body.innerHTML}\n</body>\n</html>`;
}

function plansSaveWordFile(wordHtml, filename) {
  const blob = new Blob(["\ufeff" + wordHtml], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
}

function plansSanitizeName(name) {
  return String(name || "document").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

async function plansDownloadWord(id) {
  const detail = await request(`/teacher-plans/${id}?_t=${Date.now()}`).catch(() => null);
  if (!detail) { alert("Could not load document"); return; }
  plansSaveWordFile(plansBuildWordHtml(detail.html_render || ""), plansSanitizeName("casuya_" + (detail.title || "document")) + ".doc");
}

function plansDownloadLastGeneratedWord(filename) {
  if (!plansGetLastGenHtml()) return;
  plansSaveWordFile(plansBuildWordHtml(plansGetLastGenHtml()), plansSanitizeName(filename || "casuya_document") + ".doc");
}

async function plansSaveGenerated(form, res, planType) {
  const fd = new FormData(form);
  const ss = fd.get("subject_slug");
  const isSw = plansIsSwSubject(ss);
  const subjectName = plansSubjects.find(s => s.slug === ss)?.name || ss;
  return request("/teacher-plans/save", {
    method: "POST",
    body: JSON.stringify({
      plan_type: planType,
      title: res.title,
      subject_slug: ss,
      subject_name: subjectName,
      form_level: parseInt(fd.get("form_level")) || 2,
      topic: fd.get("topic") || res.title,
      subtopic: fd.get("subtopic") || null,
      term: fd.get("term") || null,
      plan_data: JSON.stringify(res.plan_data),
      html_render: res.html_render,
      language: isSw ? "sw" : "en",
    }),
  });
}

function plansRenderGenerated(res, planType) {
  plansSetLastGenHtml(res.html_render || "");
  const actionsId = planType === "scheme_of_work" ? "tdoc-scheme-preview-actions" : "tdoc-lesson-preview-actions";
  setTimeout(() => { const actionsEl = document.getElementById(actionsId); if (actionsEl) actionsEl.style.display = "flex"; }, 50);
  return `<iframe class="tdocs-preview-frame" id="gen-frame" style="width:100%;min-height:520px;border:none;background:#fff"></iframe>`;
}

function plansOpenPreview() {
  if (!plansGetLastGenHtml()) return;
  const win = window.open("", "_blank", "width=1100,height=750");
  if (win) { win.document.write(plansGetLastGenHtml()); win.document.close(); }
  else { alert("Popup blocked. Allow popups to preview/export."); }
}

function plansPrintPreview() {
  if (!plansGetLastGenHtml()) return;
  const win = window.open("", "_blank", "width=1100,height=750");
  if (win) { win.document.write(plansGetLastGenHtml()); win.document.close(); win.focus(); setTimeout(() => win.print(), 500); }
  else { alert("Popup blocked. Allow popups to print."); }
}

function plansFillGenFrame() {
  const frame = document.getElementById("gen-frame");
  if (frame && plansGetLastGenHtml()) frame.srcdoc = plansGetLastGenHtml();
}