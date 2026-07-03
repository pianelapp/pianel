/**
 * Task 2.1 — failing tests for the web persistent storage adapter.
 *
 * Covers: round-trip get/set/remove, null for a missing key, async resolution
 * after the write commits, fallback to localStorage when IndexedDB is
 * unavailable, and the non-fatal write-failure path (onWriteError invoked,
 * no throw into the caller).
 */
import type { StateStorage } from '@pianel/core/store/storage';
import { createIndexedDbStorage } from '../src/store/indexedDbStorage';

describe('createIndexedDbStorage', () => {
  beforeEach(() => {
    // Reset the persistent store between tests by clearing localStorage; the
    // fake IndexedDB is reset per test file via fake-indexeddb/auto + unique
    // db names below where needed.
    window.localStorage.clear();
  });

  it('satisfies the StateStorage contract shape', () => {
    const storage: StateStorage = createIndexedDbStorage({ dbName: 'shape-db' });
    expect(typeof storage.getItem).toBe('function');
    expect(typeof storage.setItem).toBe('function');
    expect(typeof storage.removeItem).toBe('function');
  });

  it('round-trips get/set/remove with the same string keys', async () => {
    const storage = createIndexedDbStorage({ dbName: 'roundtrip-db' });

    expect(await storage.getItem('pianel-profiles')).toBeNull();

    await storage.setItem('pianel-profiles', '{"profiles":[]}');
    expect(await storage.getItem('pianel-profiles')).toBe('{"profiles":[]}');

    await storage.removeItem('pianel-profiles');
    expect(await storage.getItem('pianel-profiles')).toBeNull();
  });

  it('uses the "pianel" default database name and round-trips against it', async () => {
    // No dbName override → exercises the default (renamed fp30x → pianel).
    const storage = createIndexedDbStorage();
    expect(await storage.getItem('pianel:profiles')).toBeNull();
    await storage.setItem('pianel:profiles', '{"profiles":[]}');
    expect(await storage.getItem('pianel:profiles')).toBe('{"profiles":[]}');
    await storage.removeItem('pianel:profiles');
    expect(await storage.getItem('pianel:profiles')).toBeNull();
  });

  it('returns null for a missing key', async () => {
    const storage = createIndexedDbStorage({ dbName: 'missing-db' });
    expect(await storage.getItem('never-written')).toBeNull();
  });

  it('resolves a read only after the write has committed', async () => {
    const storage = createIndexedDbStorage({ dbName: 'commit-db' });
    await storage.setItem('k', 'v1');
    // The value read immediately after awaiting setItem must reflect the write.
    expect(await storage.getItem('k')).toBe('v1');
    await storage.setItem('k', 'v2');
    expect(await storage.getItem('k')).toBe('v2');
  });

  it('falls back to localStorage when IndexedDB is unavailable', async () => {
    const storage = createIndexedDbStorage({
      dbName: 'fallback-db',
      // Force the primary store to be considered unavailable.
      isIndexedDbAvailable: () => false,
    });

    await storage.setItem('pianel-settings', '{"theme":"dark"}');
    expect(await storage.getItem('pianel-settings')).toBe('{"theme":"dark"}');
    // Proves the fallback substrate (localStorage) actually held the value.
    expect(window.localStorage.getItem('pianel-settings')).toBe('{"theme":"dark"}');

    await storage.removeItem('pianel-settings');
    expect(window.localStorage.getItem('pianel-settings')).toBeNull();
  });

  it('surfaces a non-fatal error via onWriteError and does not throw on write failure', async () => {
    const onWriteError = jest.fn();
    const storage = createIndexedDbStorage({
      dbName: 'quota-db',
      // Force the fallback path, then simulate a quota/blocked write error there.
      isIndexedDbAvailable: () => false,
      onWriteError,
    });

    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
    const setSpy = jest
      .spyOn(window.localStorage.__proto__, 'setItem')
      .mockImplementation(() => {
        throw quotaError;
      });

    // Must not throw into the caller.
    await expect(storage.setItem('pianel-favorites', 'x')).resolves.toBeUndefined();
    expect(onWriteError).toHaveBeenCalledTimes(1);
    expect(onWriteError).toHaveBeenCalledWith('pianel-favorites', quotaError);

    setSpy.mockRestore();
  });
});
