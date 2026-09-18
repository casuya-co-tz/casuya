import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CasuyaBridge } from '../../src/core/bridge.js';
import { EVENTS } from '../../src/core/constants.js';
import { resolveAssetUrl, rewriteHtmlDependencies } from '../../src/rendering/dependencies.js';
import { LessonRenderer } from '../../src/rendering/renderer.js';
import { PackageStore } from '../../src/storage/packages.js';

test('resolveAssetUrl prefixes relative paths and leaves absolute URLs', () => {
  assert.equal(
    resolveAssetUrl('/static/lib/katex.min.css', 'https://api.casuya.co.tz'),
    'https://api.casuya.co.tz/static/lib/katex.min.css'
  );
  assert.equal(
    resolveAssetUrl('https://cdn.example/a.css', 'https://api.casuya.co.tz'),
    'https://cdn.example/a.css'
  );
  assert.equal(resolveAssetUrl('data:text/plain,hi', 'https://api.casuya.co.tz'), 'data:text/plain,hi');
});

test('rewriteHtmlDependencies rewrites relative src/href only', () => {
  const html = '<link href="/a.css"><script src="https://x/y.js"></script>';
  const out = rewriteHtmlDependencies(html, 'https://api.example');
  assert.equal(out, '<link href="https://api.example/a.css"><script src="https://x/y.js"></script>');
});

test('renderLesson mounts cached body_html and emits ready', async () => {
  const bridge = new CasuyaBridge({ sandboxMode: 'iframe' });
  await bridge.runtime.packageStore.save('mole-concept', { body_html: '<p>hello</p>' });
  const mount = { innerHTML: 'old', children: [], appendChild(node) { this.children.push(node); return node; }, replaceChildren() { this.children = []; this.innerHTML = ''; } };

  const events = [];
  bridge.on(EVENTS.LESSON_READY, (p) => events.push(p));
  const result = await bridge.renderLesson('mole-concept', mount);
  assert.equal(result.slug, 'mole-concept');
  assert.equal(result.mode, 'iframe');
  assert.equal(events.length, 1);
  assert.equal(bridge.runtime.renderer.state, 'ready');
});

test('renderLesson throws and emits error when package is missing', async () => {
  const bridge = new CasuyaBridge();
  const mount = { innerHTML: '', replaceChildren() { this.innerHTML = ''; } };
  let errorEvent = null;
  bridge.on(EVENTS.LESSON_ERROR, (p) => { errorEvent = p; });
  await assert.rejects(() => bridge.renderLesson('missing-slug', mount), /not cached/);
  assert.equal(errorEvent.slug, 'missing-slug');
  assert.equal(bridge.runtime.renderer.state, 'error');
});

test('LessonRenderer shadow-dom writes into attachShadow', async () => {
  const store = new PackageStore({
    async get() { return { body_html: '<h1>Hi</h1>' }; },
  });
  const renderer = new LessonRenderer({ packageStore: store, config: { sandboxMode: 'shadow-dom' } });
  const shadow = { innerHTML: '' };
  const mount = {
    innerHTML: '',
    replaceChildren() { this.innerHTML = ''; },
    attachShadow() { return shadow; },
  };
  const result = await renderer.render('x', mount);
  assert.equal(result.mode, 'shadow-dom');
  assert.equal(shadow.innerHTML, '<h1>Hi</h1>');
});
