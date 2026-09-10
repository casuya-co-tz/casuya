// modules/teacher/plans/actions.js — preview/print/word buttons + saved document actions.

function setupActions(state) {
  document.getElementById("gen-view")?.addEventListener("click", e => { e.preventDefault(); plansOpenPreview(); });
  document.getElementById("gen-print")?.addEventListener("click", e => { e.preventDefault(); plansPrintPreview(); });
  document.getElementById("gen-doc")?.addEventListener("click", e => { e.preventDefault(); plansDownloadLastGeneratedWord("lesson_plan"); });
  document.getElementById("scheme-view")?.addEventListener("click", e => { e.preventDefault(); plansOpenPreview(); });
  document.getElementById("scheme-print")?.addEventListener("click", e => { e.preventDefault(); plansPrintPreview(); });
  document.getElementById("scheme-doc")?.addEventListener("click", e => { e.preventDefault(); plansDownloadLastGeneratedWord("scheme_of_work"); });

  document.getElementById("tdocs-saved-list")?.addEventListener("click", async ev => {
    const viewBtn = ev.target.closest("[data-view]");
    const printBtn = ev.target.closest("[data-print]");
    const docBtn = ev.target.closest("[data-doc]");
    const delBtn = ev.target.closest("[data-del]");
    if (viewBtn) { ev.preventDefault(); await plansViewDocument(viewBtn.dataset.view); }
    else if (printBtn) { ev.preventDefault(); await plansPrintDocument(printBtn.dataset.print); }
    else if (docBtn) { ev.preventDefault(); await plansDownloadWord(docBtn.dataset.doc); }
    else if (delBtn) {
      ev.preventDefault();
      if (confirm("Delete this document?")) {
        await request(`/teacher-plans/${delBtn.dataset.del}`, { method: "DELETE" }).catch(()=>{});
        await loadSaved(state);
        renderSubTabs(state);
        renderSavedList(state);
      }
    }
  });
}