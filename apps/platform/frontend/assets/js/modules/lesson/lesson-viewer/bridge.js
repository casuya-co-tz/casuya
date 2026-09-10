// modules/lesson/lesson-viewer/bridge.js — inject the lesson bridge script into lesson HTML.

function injectBridgeScript(html) {
  const bridgeScript = LESSON_BRIDGE_SCRIPT;
  const bodyIdx = html.lastIndexOf("</body>");
  if (bodyIdx !== -1) {
    return html.slice(0, bodyIdx) + bridgeScript + html.slice(bodyIdx);
  }
  return html.replace("</html>", bridgeScript + "</html>");
}