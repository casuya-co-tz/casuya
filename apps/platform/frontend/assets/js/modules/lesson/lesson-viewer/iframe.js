// modules/lesson/lesson-viewer/iframe.js — lesson iframe mount + teardown.

let _currentLessonIframe = null;
let _currentLessonCleanup = null;

function teardownCurrentIframe() {
  if (typeof _currentLessonCleanup === "function") {
    try { _currentLessonCleanup(); } catch (e) {}
    _currentLessonCleanup = null;
  }
  if (_currentLessonIframe) {
    try {
      const ivs = _currentLessonIframe.contentWindow?.casuya?._intervals || [];
      ivs.forEach(id => _currentLessonIframe.contentWindow.clearInterval(id));
    } catch(e) {}
    _currentLessonIframe = null;
  }
}

async function mountLessonIframe(container, html) {
  teardownCurrentIframe();
  const mount = container.querySelector(".lesson-iframe") || container;
  if (typeof mountLessonRuntime === "function") {
    const handle = await mountLessonRuntime(mount, html, { id: "lesson", title: "Lesson" });
    _currentLessonIframe = handle.getIframe ? handle.getIframe() : mount.querySelector("iframe");
    _currentLessonCleanup = handle.cleanup;
    return _currentLessonIframe;
  }
  if (mount.tagName === "IFRAME") {
    _currentLessonIframe = mount;
    mount.srcdoc = injectNodeBase(html);
  } else if (typeof mountGameSrcdoc === "function") {
    const handle = mountGameSrcdoc(mount, typeof injectNodeBase === "function" ? injectNodeBase(html) : html);
    _currentLessonIframe = handle.getIframe ? handle.getIframe() : mount.querySelector("iframe");
    _currentLessonCleanup = handle.cleanup;
    return _currentLessonIframe;
  }
  return _currentLessonIframe;
}
