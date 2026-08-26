// rum.js — Real-User-Monitoring (P3-3). Reports paint + network timings from
// real devices so we optimize for actual Tanzanian 3G, not localhost. Loaded on
// every dashboard page; the endpoint (/metrics/rum) is public + anonymous.
(function () {
  function send(ev) {
    try {
      var body = JSON.stringify(ev);
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/metrics/rum", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/metrics/rum", {
          method: "POST",
          body: body,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        }).catch(function () {});
      }
    } catch (e) {}
  }

  function collect() {
    var ev = { path: location.pathname, dpr: window.devicePixelRatio || 1, t: Date.now() };
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (c) {
      ev.effectiveType = c.effectiveType;
      ev.downlink = c.downlink;
      ev.rtt = c.rtt;
      ev.saveData = c.saveData;
    }
    try {
      var nav = performance.getEntriesByType("navigation")[0];
      if (nav) {
        ev.ttfb = Math.round(nav.responseStart - nav.requestStart);
        ev.domLoad = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
        ev.load = Math.round(nav.loadEventEnd - nav.startTime);
      }
    } catch (e) {}
    try {
      performance.getEntriesByType("paint").forEach(function (p) {
        if (p.name === "first-contentful-paint") ev.fcp = Math.round(p.startTime);
        if (p.name === "first-paint") ev.fp = Math.round(p.startTime);
      });
    } catch (e) {}
    if (ev.fcp || ev.ttfb) send(ev);
  }

  if (document.readyState === "complete") collect();
  else window.addEventListener("load", collect);
  // Late FCP can arrive after load on slow networks — sample once more.
  setTimeout(collect, 4000);
})();
