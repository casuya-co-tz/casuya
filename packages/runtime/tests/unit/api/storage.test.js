import { StorageAPI } from '../../../src/api/storage-api.js';

describe('StorageAPI', () => {
  let storage;

  beforeEach(() => {
    storage = new StorageAPI({ namespace: 'test' });
  });

  test('should set and get values', async () => {
    await storage.set('key1', 'value1');
    expect(await storage.get('key1')).toBe('value1');
  });

  test('should return default for missing keys', async () => {
    expect(await storage.get('missing', 'default')).toBe('default');
  });

  test('should check key existence', async () => {
    await storage.set('exists', 'yes');
    expect(await storage.has('exists')).toBe(true);
    expect(await storage.has('no')).toBe(false);
  });

  test('should delete values', async () => {
    await storage.set('delete-me', 'value');
    await storage.delete('delete-me');
    expect(await storage.get('delete-me')).toBeNull();
  });

  test('should serialize complex objects', async () => {
    const obj = { a: 1, b: [2, 3], c: { d: 4 } };
    await storage.set('obj', obj);
    const retrieved = await storage.get('obj');
    expect(retrieved).toEqual(obj);
  });

  test('should set and get namespace', () => {
    storage.setNamespace('custom');
  });
});