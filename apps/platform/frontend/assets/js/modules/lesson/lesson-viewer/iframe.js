// modules/lesson/lesson-viewer/iframe.js — lesson iframe mount + teardown.

let _currentLessonIframe = null;

function teardownCurrentIframe() {
  if (_currentLessonIframe) {
    try {
      const ivs = _currentLessonIframe.contentWindow?.casuya?._intervals || [];
      ivs.forEach(id => _currentLessonIframe.contentWindow.clearInterval(id));
    } catch(e) {}
    _currentLessonIframe = null;
  }
}

function mountLessonIframe(container, html) {
  const iframe = container.querySelector(".lesson-iframe");
  _currentLessonIframe = iframe;
  iframe.srcdoc = injectNodeBase(html);
  let heightSet = false;
  const setHeight = () => {
    if (heightSet) return;
    try {
      const doc = iframe.contentWindow?.document;
      if (doc) {
        iframe.style.height = Math.max(doc.documentElement?.scrollHeight || 0, doc.body?.scrollHeight || 0, 300) + "px";
        heightSet = true;
      }
    } catch(e) {}
  };
  iframe.addEventListener("load", setHeight);
  const poll = setInterval(() => { setHeight(); if (heightSet) clearInterval(poll); }, 300);
  setTimeout(() => { clearInterval(poll); if (!heightSet) iframe.style.height = "800px"; }, 10000);
  return iframe;
}