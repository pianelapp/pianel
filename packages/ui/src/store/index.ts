import {
  createConnectionStore,
  createPerformanceStore,
  createFavoritesStore,
  createProfilesStore,
  createAppSettingsStore,
} from '@pianel/core/store';
import type { StateStorage } from '@pianel/core/store';

/**
 * The five domain store hooks are stable singletons owned by `@pianel/core`:
 * each is a forwarding proxy bound to a concrete `StateStorage` the first time
 * its factory runs (and it throws if read before then). The shared renderer
 * (components/hooks) imports these from here; the host binds them via
 * {@link initStores}.
 */
export {
  useConnectionStore,
  usePerformanceStore,
  useFavoritesStore,
  useProfilesStore,
  useAppSettingsStore,
} from '@pianel/core/store';

export type {
  StateStorage,
  ConnectionStatus, ConnectionState, ConnectionActions, DiscoveredDevice,
  PerformanceState, PerformanceActions,
  FavoriteTone, FavoritesState, FavoritesActions,
  Preset, Profile, ProfileExportFile, FavoriteRef,
  PerformanceSnapshot,
  ProfilesState, ProfilesActions,
  ThemePreference, AccidentalPreference, AppSettingsState, AppSettingsActions,
} from '@pianel/core/store';

export {
  PRESET_TILE_COUNT,
  MAX_SUPPORTED_SCHEMA_VERSION,
  selectActiveProfile,
  selectActivePresets,
  DEFAULT_PERFORMANCE_SNAPSHOT,
  DuplicateProfileNameError,
  ProfileNotFoundError,
  MalformedProfileFileError,
  UnsupportedProfileVersionError,
  PresetGridFullError,
} from '@pianel/core/store';

let initialized = false;

/**
 * Bind the five shared domain stores to a host-provided `StateStorage`
 * substrate — `electron-store` on the Electron desktop host, IndexedDB on the
 * browser/PWA web host. Each host MUST call this exactly once, before rendering
 * the app or reading any store.
 *
 * Idempotent: subsequent calls are ignored so hot-reload / double-import can't
 * rebuild (and thus reset) the live stores.
 */
export function initStores(storage: StateStorage): void {
  if (initialized) return;
  createConnectionStore({ storage });
  createPerformanceStore({ storage });
  createFavoritesStore({ storage });
  createProfilesStore({ storage });
  createAppSettingsStore({ storage });
  initialized = true;
}
