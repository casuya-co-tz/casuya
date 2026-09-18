// modules/student/lazy-views.js — stub hash routes until student.extras.bundle.js loads.

"use strict";

var STUDENT_EXTRAS_SRC = "/assets/js/student.extras.bundle.js";

var STUDENT_LAZY_GROUPS = [
  { register: "registerGamesView", views: ["games", "game"] },
  { register: "registerExamsView", views: ["exams", "start-exam"] },
  { register: "registerTestsView", views: ["test-generator"] },
  { register: "registerFilesView", views: ["files"] },
  { register: "registerLibraryView", views: ["library"] },
  { register: "registerPaymentsView", views: ["payments"] },
  { register: "registerDownloadsView", views: ["downloads"] },
];

function registerLazyStudentViews(d) {
  function applyRegisters() {
    STUDENT_LAZY_GROUPS.forEach(function (g) {
      var fn = typeof window[g.register] === "function" ? window[g.register] : null;
      if (fn) fn(d);
    });
  }

  function loadExtras() {
    return loadCasuyaScript(STUDENT_EXTRAS_SRC).then(applyRegisters);
  }

  d._prefetchExtras = loadExtras;

  STUDENT_LAZY_GROUPS.forEach(function (g) {
    g.views.forEach(function (name) {
      function lazyStub() {
        var args = arguments;
        d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
        return loadExtras().then(function () {
          var next = d._views[name];
          if (!next || next._lazy) {
            throw new Error("Missing view " + name);
          }
          return next.apply(null, args);
        }).catch(function () {
          d.showView('<div class="empty-state"><p>Could not load this section. Check your connection and try again.</p></div>');
        });
      }
      lazyStub._lazy = true;
      d.registerView(name, lazyStub);
    });
  });
}
