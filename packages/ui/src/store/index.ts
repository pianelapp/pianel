import {
  createConnectionStore,
  createPerformanceStore,
  createFavoritesStore,
  createProfilesStore,
  createAppSettingsStore,
} from '@pianel/core/store';
import type { StateStorage } from '@pianel/core/store';

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
  CURRENT_SCHEMA_VERSION,
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

export function initStores(storage: StateStorage): void {
  if (initialized) return;
  createConnectionStore({ storage });
  createPerformanceStore({ storage });
  createFavoritesStore({ storage });
  createProfilesStore({ storage });
  createAppSettingsStore({ storage });
  initialized = true;
}
