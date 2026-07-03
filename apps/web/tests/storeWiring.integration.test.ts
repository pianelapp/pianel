/**
 * Task 2.3 — integration test for web store wiring.
 *
 * Proves the shared core store factories, when injected with the web
 * IndexedDB-backed `StateStorage` adapter, hydrate from previously persisted
 * data and persist mutations across a simulated reload (a fresh store instance
 * reading the same IndexedDB substrate).
 *
 * Uses the jsdom + fake-indexeddb environment configured in tests/setup.ts.
 */
import { createAppSettingsStore } from '@pianel/core/store';
import { createIndexedDbStorage } from '../src/store/indexedDbStorage';

// The store factory returns a forwarding proxy that does not expose zustand's
// `persist` API, and hydration from the (async) IndexedDB substrate completes a
// microtask after creation. Poll the predicate until it holds or time out.
async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 1000,
): Promise<void> {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor: condition not met before timeout');
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe('web store wiring (IndexedDbStorage + core store factory)', () => {
  it('persists a mutation and re-hydrates it on a simulated reload', async () => {
    // Shared, durable substrate across both "launches".
    const storage = createIndexedDbStorage({ dbName: 'wiring-db', storeName: 'kv' });

    // ── First launch: default state, then a user mutation ──
    const store1 = createAppSettingsStore({ storage });
    // No persisted data yet → default after hydration settles.
    await waitFor(() => store1.getState().themePreference === 'system');

    store1.getState().setThemePreference('light');

    // Confirm it actually landed in the storage substrate under the store key
    // once zustand's async persist write has committed to IndexedDB.
    await waitFor(async () => {
      const current = await storage.getItem('pianel:app-settings');
      return current !== null && JSON.parse(current).state.themePreference === 'light';
    });
    const raw = await storage.getItem('pianel:app-settings');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).state.themePreference).toBe('light');

    // ── Simulated reload: a brand-new store instance over the same substrate ──
    const store2 = createAppSettingsStore({ storage });
    await waitFor(() => store2.getState().themePreference === 'light');
    expect(store2.getState().themePreference).toBe('light');
  });
});
