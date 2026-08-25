import { Sandbox } from '../../src/sandbox/sandbox.js';
import { JavaScriptEngine } from '../../src/sandbox/javascript-engine/index.js';
import { PermissionManager } from '../../src/sandbox/permissions/index.js';
import { ExecutionContext } from '../../src/sandbox/execution-context/index.js';
import { SecurityPolicies } from '../../src/sandbox/security-policies/index.js';

describe('Sandbox', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = new Sandbox({
      allowStorage: true,
      allowCanvas: true
    });
  });

  afterEach(() => {
    sandbox.destroy();
  });

  test('should setup with package permissions', () => {
    const pkg = { manifest: { id: 'test', version: '1.0.0', title: 'Test', permissions: ['storage'] } };
    sandbox.setup(pkg);
    expect(sandbox.hasPermission('storage')).toBe(true);
  });

  test('should not have unconfigured permissions', () => {
    sandbox.setup({ manifest: { id: 'test', version: '1.0.0', title: 'Test', permissions: [] } });
    expect(sandbox.hasPermission('quiz')).toBe(false);
  });

  test('should handle permission requests', () => {
    sandbox.setup({ manifest: { id: 'test', version: '1.0.0', title: 'Test', permissions: [] } });
    const result = sandbox.requestPermission('storage');
    expect(typeof result).toBe('boolean');
  });

  test('should provide event bus api', () => {
    sandbox.setup({ manifest: { id: 'test', version: '1.0.0', title: 'Test', permissions: [] } });
    expect(typeof sandbox.on).toBe('function');
    expect(typeof sandbox.off).toBe('function');
  });

  test('should destroy cleanly', () => {
    sandbox.setup({ manifest: { id: 'test', version: '1.0.0', title: 'Test', permissions: [] } });
    sandbox.destroy();
    expect(sandbox.getAPIs()).toEqual({});
  });
});

describe('JavaScriptEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new JavaScriptEngine({ maxExecutionTime: 1000 });
  });

  afterEach(() => {
    engine.destroy();
  });

  test('should execute simple expressions', () => {
    const win = { Math, console: { log: jest.fn() } };
    const result = engine.evaluate('2 + 2', win);
    expect(result).toBe(4);
  });

  test('should reject empty input', () => {
    const result = engine.execute('', {});
    expect(result).toBeUndefined();
  });

  test('should throw on execution timeout', () => {
    const infiniteLoop = 'while(true) {}';
    const eng2 = new JavaScriptEngine({ maxExecutionTime: 10 });
    expect(() => eng2.execute(infiniteLoop, {})).toThrow();
    eng2.destroy();
  });

  test('should respect pause/resume', () => {
    engine.pause();
    expect(() => engine.execute('1+1', {})).toThrow();
    engine.resume();
    expect(engine.execute('1+1', {})).toBe(2);
  });

  test('should track execution count', () => {
    engine.execute('1', {});
    engine.execute('2', {});
    expect(engine.getExecutionCount()).toBe(2);
  });
});

describe('PermissionManager', () => {
  let pm;

  beforeEach(() => {
    pm = new PermissionManager();
  });

  test('should configure permissions', () => {
    pm.configure(['storage', 'media']);
    expect(pm.hasPermission('storage')).toBe(true);
    expect(pm.hasPermission('media')).toBe(true);
    expect(pm.hasPermission('quiz')).toBe(false);
  });

  test('should check multiple permissions', () => {
    pm.configure(['storage', 'quiz', 'timer']);
    expect(pm.hasAll(['storage', 'quiz'])).toBe(true);
    expect(pm.hasAll(['storage', 'admin'])).toBe(false);
    expect(pm.hasAny(['storage', 'admin'])).toBe(true);
  });

  test('should grant and deny permissions', () => {
    pm.grant('canvas');
    expect(pm.hasPermission('canvas')).toBe(true);
    pm.deny('canvas');
    expect(pm.hasPermission('canvas')).toBe(false);
  });

  test('should revoke permissions', () => {
    pm.configure(['storage']);
    pm.revoke('storage');
    expect(pm.hasPermission('storage')).toBe(false);
  });

  test('should return granted and denied lists', () => {
    pm.configure(['storage']);
    pm.deny('microphone');
    expect(pm.getGranted()).toContain('storage');
    expect(pm.getDenied()).toContain('microphone');
  });

  test('should reset permissions', () => {
    pm.configure(['storage']);
    pm.deny('microphone');
    pm.reset();
    expect(pm.getGranted()).not.toContain('microphone');
  });

  test('should emit events', () => {
    const listener = jest.fn();
    pm.on('permission:granted', listener);
    pm.grant('test-perm');
    expect(listener).toHaveBeenCalled();
  });
});

describe('ExecutionContext', () => {
  let ctx;

  beforeEach(() => {
    ctx = new ExecutionContext({
      packageId: 'test-pkg',
      permissions: ['storage', 'quiz'],
      allowedGlobals: ['Math', 'JSON', 'Array']
    });
  });

  test('should provide context data', () => {
    const data = ctx.getContextData();
    expect(data.packageId).toBe('test-pkg');
    expect(data.runtimeVersion).toBe('1.0.0');
    expect(data.permissions).toEqual(['storage', 'quiz']);
  });

  test('should check permissions', () => {
    expect(ctx.hasPermission('storage')).toBe(true);
    expect(ctx.hasPermission('admin')).toBe(false);
  });

  test('should get and set variables', () => {
    ctx.set('username', 'student1');
    expect(ctx.get('username')).toBe('student1');
  });

  test('should return allowed globals', () => {
    expect(ctx.getAllowedGlobals()).toContain('Math');
    expect(ctx.getAllowedGlobals()).not.toContain('fetch');
  });

  test('should support freeze/unfreeze', () => {
    ctx.set('a', 1);
    ctx.freeze();
    expect(ctx.isFrozen()).toBe(true);
    expect(() => ctx.set('b', 2)).toThrow();
    ctx.unfreeze();
    ctx.set('b', 2);
    expect(ctx.get('b')).toBe(2);
  });

  test('should provide runtime API via context', () => {
    const api = ctx._getContextAPI();
    expect(api.getPackageId()).toBe('test-pkg');
    expect(api.isSandboxed()).toBe(true);
    expect(api.hasPermission('storage')).toBe(true);
    expect(api.hasPermission('admin')).toBe(false);
  });
});

describe('SecurityPolicies', () => {
  let sp;

  beforeEach(() => {
    sp = new SecurityPolicies();
  });

  test('should block dangerous property access', () => {
    expect(sp.checkAccess('constructor')).toBe(false);
    expect(sp.checkAccess('__proto__')).toBe(false);
    expect(sp.checkAccess('validProp')).toBe(true);
  });

  test('should block dangerous APIs', () => {
    expect(sp.checkAPI('fetch')).toBe(false);
    expect(sp.checkAPI('localStorage')).toBe(false);
    expect(sp.checkAPI('XMLHttpRequest')).toBe(false);
    expect(sp.checkAPI('quiz-api')).toBe(true);
  });

  test('should validate resource URLs', () => {
    expect(sp.validateResourceAccess('https://safe.com')).toBe(true);
    expect(sp.validateResourceAccess('javascript:alert(1)')).toBe(false);
  });

  test('should handle empty policies', () => {
    sp.clearPolicies();
    expect(sp.getPolicies()).toHaveLength(0);
  });

  test('should toggle active state', () => {
    sp.setActive(false);
    expect(sp.checkAccess('constructor')).toBe(true);
    sp.setActive(true);
    expect(sp.checkAccess('constructor')).toBe(false);
  });
});
