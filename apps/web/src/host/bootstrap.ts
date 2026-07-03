/**
 * Web bootstrap sequence (Task 5.2).
 *
 * Mirrors the desktop entry's bootstrap: ensure a default profile exists, then
 * load the boot/active profile so UI config (favorites, theme, accidentals,
 * quick-tone slots, active preset list) hydrates from it.
 *
 * The web `StateStorage` is IndexedDB-backed and therefore asynchronous, so —
 * unlike the synchronous Electron store — we must await the first storage read
 * to settle before running the profile sequence, otherwise `ensureDefaultProfile`
 * could race the async hydration and create a duplicate default profile on a
 * relaunch (Req 4.5). `waitForStoreHydration` polls the persisted store keys
 * until the (async) zustand `persist` rehydrate has committed.
 *
 * Extracted from the entry so it is unit/integration-testable with a fake
 * IndexedDB substrate. Profile load is non-audible (it never touches the
 * piano), so it is safe to run on every launch.
 */
import type { ProfileService } from '@pianel/core/services/profiles/ProfileService';
import type { StateStorage } from '@pianel/core/store';

interface BootstrapStores {
  getBootProfileId: () => string | null;
  getActiveProfileId: () => string | null;
  getProfileIds: () => string[];
}

/**
 * Wait until the async storage read for a given key resolves (or the timeout
 * elapses). Used to avoid the hydration race before bootstrap.
 */
export async function waitForStorageRead(
  storage: StateStorage,
  key: string,
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now();
  // A single resolved read is enough to know the async substrate is reachable;
  // a `null` (no data yet) is a valid "settled" result on first launch.
  // We still give zustand's rehydrate a microtask to apply by polling briefly.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await storage.getItem(key);
      return;
    } catch {
      if (Date.now() - start > timeoutMs) return;
      await new Promise((r) => setTimeout(r, 10));
    }
  }
}

/**
 * Run the profile bootstrap. Awaits the first async storage read to avoid the
 * hydration race, ensures a default profile exists, then loads the boot/active
 * profile if present.
 */
export async function runBootstrap(
  profileService: ProfileService,
  stores: BootstrapStores,
  storage: StateStorage,
  options: { profilesStoreKey?: string } = {},
): Promise<void> {
  const profilesKey = options.profilesStoreKey ?? 'pianel:profiles';
  // Await the first async storage read so zustand `persist` has a chance to
  // rehydrate the profiles store before we decide whether to create a default.
  await waitForStorageRead(storage, profilesKey);

  await profileService.ensureDefaultProfile();

  const bootProfileId = stores.getBootProfileId();
  const activeProfileId = stores.getActiveProfileId();
  const candidateId = bootProfileId ?? activeProfileId;
  if (candidateId && stores.getProfileIds().includes(candidateId)) {
    await profileService.loadProfile(candidateId);
  }
}
