export const ASSETS = {
  DEFAULT_STYLES: `
    .casuya-runtime { position: relative; width: 100%; height: 100%; overflow: hidden; }
    .casuya-runtime iframe { width: 100%; height: 100%; border: none; }
    .casuya-runtime-error { display: flex; align-items: center; justify-content: center; height: 100%; background: #f8f9fa; color: #dc3545; font-family: sans-serif; padding: 2rem; text-align: center; }
    .casuya-runtime-loading { display: flex; align-items: center; justify-content: center; height: 100%; background: #f8f9fa; color: #6c757d; font-family: sans-serif; }
  `,
  DEFAULT_SCRIPT: `
    window.__CASUYA_RUNTIME__ = true;
    window.addEventListener('error', function(e) {
      window.parent.postMessage({ type: '__CASUYA_ERROR__', error: e.message }, '*');
    });
  `,
  ERROR_HTML: `
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8f9fa;font-family:sans-serif;color:#dc3545;text-align:center;padding:2rem}
    h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#6c757d}</style></head>
    <body><div><h1>Lesson Error</h1><p>The lesson could not be loaded.</p></div></body></html>
  `,
  OFFLINE_HTML: `
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8f9fa;font-family:sans-serif;text-align:center;padding:2rem}
    .icon{font-size:3rem;margin-bottom:1rem}h1{font-size:1.5rem;margin-bottom:0.5rem;color:#333}p{color:#6c757d;margin-bottom:1.5rem}
    .retry-btn{padding:0.75rem 2rem;background:#0d6efd;color:#fff;border:none;border-radius:0.5rem;cursor:pointer;font-size:1rem}
    .retry-btn:hover{background:#0b5ed7}</style></head>
    <body><div><div class="icon">&#9888;</div><h1>No Internet Connection</h1><p>Your saved progress will sync automatically when connected.</p><button class="retry-btn" onclick="location.reload()">Retry</button></div></body></html>
  `
};

export function getAsset(name) {
  return ASSETS[name] || null;
}

export function injectDefaultStyles(doc) {
  if (!doc?.head) return;
  const style = doc.createElement('style');
  style.textContent = ASSETS.DEFAULT_STYLES;
  style.setAttribute('data-casuya-asset', '');
  doc.head.appendChild(style);
}
