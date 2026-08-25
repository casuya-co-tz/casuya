import { jest } from '@jest/globals';
import { SecurityManager } from '../../src/security/security-manager.js';
import { Sanitizer } from '../../src/security/sanitizer.js';
import { ContentSecurityPolicy } from '../../src/security/content-security.js';

describe('SecurityManager', () => {
  let sm;

  beforeEach(() => {
    sm = new SecurityManager();
  });

  test('should validate valid packages', () => {
    const pkg = {
      manifest: { id: 'test', version: '1.0.0', title: 'Test' }
    };
    expect(sm.validatePackage(pkg)).toBe(true);
  });

  test('should reject packages without manifest', () => {
    expect(() => sm.validatePackage({})).toThrow();
  });

  test('should reject invalid version format', () => {
    const pkg = {
      manifest: { id: 'test', version: 'abc', title: 'Test' }
    };
    expect(() => sm.validatePackage(pkg)).toThrow();
  });

  test('should validate permission requests', () => {
    const pkg = {
      manifest: { id: 'test', version: '1.0.0', title: 'Test', permissions: ['storage', 'media'] }
    };
    expect(sm.validatePackage(pkg)).toBe(true);
  });

  test('should reject invalid permissions', () => {
    const pkg = {
      manifest: { id: 'test', version: '1.0.0', title: 'Test', permissions: ['admin'] }
    };
    expect(() => sm.validatePackage(pkg)).toThrow();
  });

  test('should sanitize HTML', () => {
    const sanitized = sm.sanitizeHTML('<script>alert("xss")</script><p>Hello</p>');
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('<p>');
  });

  test('should generate CSP headers', () => {
    const csp = sm.generateCSP();
    expect(csp).toContain('default-src');
    expect(csp).toContain("'self'");
  });

  test('should check URLs', () => {
    expect(sm.checkURL('https://example.com')).toBe(true);
    expect(sm.checkURL('javascript:alert(1)')).toBe(false);
  });
});

describe('Sanitizer', () => {
  let sanitizer;

  beforeEach(() => {
    sanitizer = new Sanitizer();
  });

  test('should remove script tags', () => {
    const result = sanitizer.sanitize('<script>evil()</script>hello');
    expect(result).not.toContain('<script>');
    expect(result).toBe('hello');
  });

  test('should remove on* event handlers', () => {
    const result = sanitizer.sanitize('<img src="x" onerror="evil()">');
    expect(result).not.toContain('onerror');
  });

  test('should remove javascript: URLs', () => {
    const result = sanitizer.sanitize('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain('javascript');
  });

  test('should strip unknown tags', () => {
    const result = sanitizer.sanitize('<unknown-tag>text</unknown-tag><p>valid</p>');
    expect(result).toBe('text<p>valid</p>');
  });

  test('should sanitize CSS', () => {
    const result = sanitizer.sanitizeCSS('color: red; expression(alert(1))');
    expect(result).not.toContain('expression');
  });

  test('should sanitize URLs', () => {
    expect(sanitizer.sanitizeURL('javascript:alert(1)')).toBe('');
    expect(sanitizer.sanitizeURL('https://safe.com')).toBe('https://safe.com');
  });

  test('should sanitize file names', () => {
    expect(sanitizer.sanitizeFileName('../../etc/passwd')).toBe('__etc_passwd');
  });
});

describe('ContentSecurityPolicy', () => {
  let csp;

  beforeEach(() => {
    csp = new ContentSecurityPolicy();
  });

  test('should generate default policy', () => {
    const policy = csp.generate();
    expect(policy).toContain("default-src 'self'");
  });

  test('should include custom directives', () => {
    const policy = csp.generate({ 'img-src': ["'self'", 'https://cdn.example.com'] });
    expect(policy).toContain('https://cdn.example.com');
  });

  test('should remove directives when set to null', () => {
    const policy = csp.generate({ 'form-action': null });
    expect(policy).not.toContain('form-action');
  });

  test('should generate sandbox-specific policy', () => {
    const policy = csp.generateForSandbox();
    expect(policy).toContain("default-src 'none'");
  });

  test('should apply CSP to document', () => {
    const doc = { createElement: jest.fn(() => ({})), head: { appendChild: jest.fn() } };
    csp.apply(doc);
    expect(doc.createElement).toHaveBeenCalledWith('meta');
  });
});
