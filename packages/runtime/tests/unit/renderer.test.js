import { Renderer } from '../../src/renderer/renderer.js';
import { HTMLRenderer } from '../../src/renderer/html-renderer/index.js';
import { CSSRenderer } from '../../src/renderer/css-renderer/index.js';

describe('Renderer', () => {
  let renderer;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (renderer) renderer.destroy();
    container.remove();
  });

  test('should require a container', () => {
    expect(() => new Renderer().initialize()).toThrow();
  });

  test('should initialize with container', () => {
    renderer = new Renderer({ container });
    renderer.initialize();
    expect(container.getAttribute('data-casuya-runtime')).toBe('');
  });

  test('should destroy cleanly', () => {
    renderer = new Renderer({ container });
    renderer.initialize();
    renderer.destroy();
    expect(container.innerHTML).toBe('');
  });

  test('should handle pause/resume', () => {
    renderer = new Renderer({ container });
    renderer.initialize();
    expect(() => renderer.pause()).not.toThrow();
    expect(() => renderer.resume()).not.toThrow();
  });

  test('should return iframe after render', () => {
    renderer = new Renderer({ container });
    renderer.initialize();
    const pkg = {
      manifest: { id: 'test', entry: 'index.html' },
      resources: {}
    };
    renderer.render(pkg, {});
    expect(renderer.getIframe()).toBeNull();
  });
});

describe('HTMLRenderer', () => {
  test('should render HTML', () => {
    const container = document.createElement('div');
    const hr = new HTMLRenderer({ parent: container });
    hr.render('<p>Hello</p>');
    expect(container.innerHTML).toBe('<p>Hello</p>');
  });

  test('should append HTML', () => {
    const container = document.createElement('div');
    const hr = new HTMLRenderer({ parent: container });
    hr.render('<p>First</p>');
    hr.append('<p>Second</p>');
    expect(container.children.length).toBe(2);
  });
});

describe('CSSRenderer', () => {
  let cssRenderer;

  beforeEach(() => {
    cssRenderer = new CSSRenderer();
  });

  afterEach(() => {
    cssRenderer.destroy();
  });

  test('should inject styles', () => {
    const style = cssRenderer.inject('body { color: red; }');
    expect(style.tagName).toBe('STYLE');
    expect(style.textContent).toBe('body { color: red; }');
  });

  test('should scope styles', () => {
    const style = cssRenderer.inject('p { margin: 0; }', 'test-scope');
    expect(style.getAttribute('data-casuya-scope')).toBe('test-scope');
  });

  test('should remove styles by scope', () => {
    cssRenderer.inject('body { color: red; }', 'remove-me');
    cssRenderer.remove('remove-me');
    const found = Array.from(document.head.querySelectorAll('style'))
      .filter(s => s.getAttribute('data-casuya-scope') === 'remove-me');
    expect(found).toHaveLength(0);
  });

  test('should destroy all styles', () => {
    cssRenderer.inject('body { color: red; }');
    cssRenderer.inject('p { color: blue; }');
    cssRenderer.destroy();
    const found = document.head.querySelectorAll('style[data-casuya-scope]');
    expect(found.length).toBe(0);
  });
});
