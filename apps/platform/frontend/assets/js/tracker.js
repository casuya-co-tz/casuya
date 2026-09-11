/* Casuya isolated web-analytics tracker (Neon analytics cluster).
 * Phase 2 of the analytics blueprint: async edge capture via sendBeacon.
 * Fires once on tab/route exit — never on the happy path. */
(function () {
  'use strict';

  var INGEST = 'https://casuya-platform-production.up.railway.app/api/analytics/ingest';
  var startTimestamp = Date.now();
  var maxScroll = 0;
  var sent = false;

  window.addEventListener('scroll', function () {
    var doc = document.documentElement;
    var total = doc.scrollHeight - window.innerHeight;
    var current = total > 0 ? Math.round((window.scrollY / total) * 100) : 0;
    if (current > maxScroll) maxScroll = Math.min(current, 100);
  }, { passive: true });

  function send() {
    if (sent) return;
    sent = true;
    var data = JSON.stringify({
      path: window.location.pathname,
      type: 'page_exit_metric',
      scroll: maxScroll,
      duration: Math.round((Date.now() - startTimestamp) / 1000)
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(INGEST, data);
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', INGEST, true);
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
      xhr.send(data);
    }
  }

  window.addEventListener('pagehide', send);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') send();
  });
})();