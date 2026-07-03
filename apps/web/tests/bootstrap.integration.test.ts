/**
 * Task 5.2 — bootstrap integration test.
 *
 * Proves the web entry's bootstrap sequence over the async IndexedDB-backed
 * `StateStorage`:
 *   1. First launch with no stored data → a default profile is created and the
 *      profiles store hydrates from it.
 *   2. Simulated relaunch (fresh store singletons over the same IndexedDB
 *      substrate) with async hydration → the persisted boot/active profile is
 *      restored, and no duplicate default profile is created.
 *
 * Runs in the jsdom + fake-indexeddb environment from tests/setup.ts. The core
 * store factories are singletons keyed by module state; re-invoking them
 * re-initializes those singletons over the same durable storage, modeling a
 * relaunch.
 */
import {
  createProfilesStore,
  createAppSettingsStore,
  createPerformanceStore,
  createFavoritesStore,
  createConnectionStore,
  useProfilesStore,
  useAppSettingsStore,
} from '@pianel/core/store';
import { PianoService } from '@pianel/core/services/PianoService';
import { PresetService } from '@pianel/core/services/presets/PresetService';
import { FP30XEngine } from '@pianel/core/engine/fp30x/FP30XEngine';
import type { Transport } from '@pianel/core/transport/types';
import { createIndexedDbStorage } from '../src/store/indexedDbStorage';
import { createWebProfileService } from '../src/services/profileService.web';
import { runBootstrap } from '../src/host/bootstrap';

class FakeTransport implements Transport {
  status: 'idle' | 'connected' | 'disconnected' = 'idle';
  deviceName: string | null = null;
  async scan(): Promise<void> {}
  async stopScan(): Promise<void> {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async destroy(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
  async send(): Promise<void> {}
}

const PROFILES_KEY = 'pianel:profiles';

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor: condition not met before timeout');
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}

function bootstrapStores() {
  return {
    getBootProfileId: () => useAppSettingsStore.getState().bootProfileId,
    getActiveProfileId: () => useProfilesStore.getState().activeProfileId || null,
    getProfileIds: () => useProfilesStore.getState().profiles.map((p) => p.id),
  };
}

function initStores(storage: ReturnType<typeof createIndexedDbStorage>) {
  createConnectionStore({ storage });
  createPerformanceStore({ storage });
  createFavoritesStore({ storage });
  createProfilesStore({ storage });
  createAppSettingsStore({ storage });
}

function buildProfileService() {
  const pianoService = new PianoService(new FakeTransport());
  pianoService.setEngine(new FP30XEngine());
  const presetService = new PresetService(pianoService);
  return createWebProfileService(pianoService, presetService);
}

describe('web bootstrap (default profile + async hydration restore)', () => {
  it('creates a default profile on first launch and restores it on relaunch', async () => {
    // A single durable IndexedDB substrate shared across both "launches".
    const storage = createIndexedDbStorage({
      dbName: 'bootstrap-db',
      storeName: 'kv',
    });

    // ── First launch ──
    initStores(storage);
    const service1 = buildProfileService();
    await runBootstrap(service1, bootstrapStores(), storage, {
      profilesStoreKey: PROFILES_KEY,
    });

    expect(useProfilesStore.getState().profiles.length).toBeGreaterThanOrEqual(1);
    const firstLaunchProfiles = useProfilesStore.getState().profiles;
    expect(firstLaunchProfiles.length).toBe(1);
    const defaultId = firstLaunchProfiles[0].id;
    expect(useProfilesStore.getState().activeProfileId).toBe(defaultId);

    // Wait for the async persist write to commit the default profile to
    // IndexedDB before simulating a relaunch.
    await waitFor(async () => {
      const raw = await storage.getItem(PROFILES_KEY);
      return (
        raw !== null && JSON.parse(raw).state.profiles?.[0]?.id === defaultId
      );
    });
    const persisted = await storage.getItem(PROFILES_KEY);
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted as string).state.profiles[0].id).toBe(defaultId);

    // ── Simulated relaunch: fresh store singletons over the same substrate ──
    initStores(storage);
    // Hydration is async; wait until the profiles store rehydrates the persisted
    // default profile before bootstrapping (the entry awaits the first read).
    await waitFor(
      () => useProfilesStore.getState().profiles.some((p) => p.id === defaultId),
    );

    const service2 = buildProfileService();
    await runBootstrap(service2, bootstrapStores(), storage, {
      profilesStoreKey: PROFILES_KEY,
    });

    // The same default profile is restored — not duplicated.
    const relaunchProfiles = useProfilesStore.getState().profiles;
    expect(relaunchProfiles.length).toBe(1);
    expect(relaunchProfiles[0].id).toBe(defaultId);
    expect(useProfilesStore.getState().activeProfileId).toBe(defaultId);
  });
});
