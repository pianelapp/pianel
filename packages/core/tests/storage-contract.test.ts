/**
 * T054: StateStorage contract tests.
 *
 * Verifies that inMemoryStorage (and by contract, any StateStorage implementation)
 * satisfies the getItem/setItem/removeItem contract expected by Zustand persist.
 */

import {inMemoryStorage} from '../src/store/storage';

describe('inMemoryStorage (StateStorage contract)', () => {
  it('getItem returns null for missing key', async () => {
    const result = await inMemoryStorage.getItem('non-existent-key');
    expect(result).toBeNull();
  });

  it('setItem and getItem round-trip', async () => {
    await inMemoryStorage.setItem('test-key', 'test-value');
    const result = await inMemoryStorage.getItem('test-key');
    expect(result).toBe('test-value');
  });

  it('setItem overwrites existing value', async () => {
    await inMemoryStorage.setItem('overwrite-key', 'first');
    await inMemoryStorage.setItem('overwrite-key', 'second');
    const result = await inMemoryStorage.getItem('overwrite-key');
    expect(result).toBe('second');
  });

  it('removeItem deletes the key', async () => {
    await inMemoryStorage.setItem('remove-key', 'value');
    await inMemoryStorage.removeItem('remove-key');
    const result = await inMemoryStorage.getItem('remove-key');
    expect(result).toBeNull();
  });

  it('removeItem on non-existent key does not throw', () => {
    expect(() => inMemoryStorage.removeItem('ghost-key')).not.toThrow();
  });

  it('stores multiple keys independently', async () => {
    await inMemoryStorage.setItem('key-a', 'value-a');
    await inMemoryStorage.setItem('key-b', 'value-b');
    expect(await inMemoryStorage.getItem('key-a')).toBe('value-a');
    expect(await inMemoryStorage.getItem('key-b')).toBe('value-b');
  });

  it('stores JSON strings (Zustand persist format)', async () => {
    const state = {version: 1, state: {connected: false}};
    const json = JSON.stringify(state);
    await inMemoryStorage.setItem('pianel:connection', json);
    const result = await inMemoryStorage.getItem('pianel:connection');
    expect(JSON.parse(result!)).toEqual(state);
  });
});
