import { Monitor } from '../../src/monitoring/monitor.js';
import { PerformanceMonitor } from '../../src/monitoring/performance-monitor.js';
import { ErrorTracker } from '../../src/monitoring/error-tracker.js';
import { MetricsCollector } from '../../src/monitoring/metrics.js';

describe('Monitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new Monitor({ enabled: true, sampleRate: 1 });
  });

  afterEach(() => {
    monitor.destroy();
  });

  test('should record marks', () => {
    monitor.startMark('test');
    const duration = monitor.endMark('test');
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  test('should handle missing end marks', () => {
    expect(monitor.endMark('nonexistent')).toBeUndefined();
  });

  test('should measure synchronous functions', () => {
    const result = monitor.measure('sync', () => 42);
    expect(result).toBe(42);
  });

  test('should measure async functions', async () => {
    const result = await monitor.measureAsync('async', async () => 84);
    expect(result).toBe(84);
  });

  test('should record errors', () => {
    monitor.recordError('test', new Error('boom'));
    const metrics = monitor.getMetrics();
    expect(metrics.errors.length).toBe(1);
  });

  test('should record metrics', () => {
    monitor.recordMetric('custom_metric', 42, { tag: 'value' });
    monitor.incrementMetric('counter', 5);
    const metrics = monitor.getMetrics();
    expect(metrics.custom).toBeDefined();
  });

  test('should enable/disable', () => {
    monitor.disable();
    expect(monitor.isEnabled()).toBe(false);
    monitor.enable();
    expect(monitor.isEnabled()).toBe(true);
  });

  test('should return error report', () => {
    monitor.recordError('ctx1', new Error('err1'));
    monitor.recordError('ctx2', new Error('err2'));
    const report = monitor.getErrorReport();
    expect(report.total).toBe(2);
  });

  test('should get performance stats', () => {
    for (let i = 0; i < 10; i++) {
      monitor.startMark('op');
      monitor.endMark('op');
    }
    const perf = monitor.getPerformance('op');
    expect(perf.count).toBeGreaterThan(0);
    expect(perf.avg).toBeGreaterThanOrEqual(0);
  });
});

describe('PerformanceMonitor', () => {
  let pm;

  beforeEach(() => {
    pm = new PerformanceMonitor({ sampleRate: 1 });
  });

  test('should record and retrieve measurements', () => {
    pm.record('render', 100);
    pm.record('render', 200);
    const stats = pm.get('render');
    expect(stats.count).toBe(2);
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(200);
    expect(stats.avg).toBe(150);
  });

  test('should return null for missing names', () => {
    expect(pm.get('nonexistent')).toBeNull();
  });

  test('should clear measurements', () => {
    pm.record('test', 50);
    pm.clear('test');
    expect(pm.get('test')).toBeNull();
  });
});

describe('ErrorTracker', () => {
  let et;

  beforeEach(() => {
    et = new ErrorTracker();
  });

  test('should record errors', () => {
    const entry = et.record('sandbox', new Error('timeout'));
    expect(entry.context).toBe('sandbox');
    expect(entry.message).toBe('timeout');
    expect(et.getAll()).toHaveLength(1);
  });

  test('should get recent errors', () => {
    et.record('ctx1', new Error('e1'));
    et.record('ctx2', new Error('e2'));
    expect(et.getRecent(1)).toHaveLength(1);
  });

  test('should filter by context', () => {
    et.record('sandbox', new Error('e1'));
    et.record('render', new Error('e2'));
    expect(et.getByContext('sandbox')).toHaveLength(1);
    expect(et.getByContext('render')).toHaveLength(1);
  });

  test('should generate report', () => {
    et.record('ctx', new Error('err'));
    const report = et.getReport();
    expect(report.total).toBe(1);
    expect(report.unique).toBe(1);
  });

  test('should clear errors', () => {
    et.record('test', new Error('e1'));
    et.clear();
    expect(et.getAll()).toHaveLength(0);
  });

  test('should enforce max errors', () => {
    for (let i = 0; i < 150; i++) {
      et.record('test', new Error(`e${i}`));
    }
    expect(et.getAll().length).toBeLessThanOrEqual(100);
  });
});

describe('MetricsCollector', () => {
  let mc;

  beforeEach(() => {
    mc = new MetricsCollector();
  });

  test('should record metric values', () => {
    mc.record('response_time', 200, { endpoint: '/api' });
    mc.record('response_time', 300, { endpoint: '/api' });
    const stats = mc.get('response_time');
    expect(stats.count).toBe(2);
    expect(stats.avg).toBe(250);
  });

  test('should increment counters', () => {
    mc.increment('requests', 1);
    mc.increment('requests', 2);
    expect(mc.getCounter('requests')).toBe(3);
  });

  test('should set gauges', () => {
    mc.gauge('memory', 512);
    expect(mc.getGauge('memory')).toBe(512);
    mc.gauge('memory', 256);
    expect(mc.getGauge('memory')).toBe(256);
  });

  test('should return null for missing gauges', () => {
    expect(mc.getGauge('nonexistent')).toBeNull();
  });

  test('should flush all data', () => {
    mc.record('test', 1);
    mc.increment('counter', 1);
    mc.gauge('g', 1);
    mc.flush();
    expect(mc.get('test')).toBeNull();
    expect(mc.getCounter('counter')).toBe(0);
    expect(mc.getGauge('g')).toBeNull();
  });
});
