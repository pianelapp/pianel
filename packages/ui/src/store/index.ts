import {
  createConnectionStore,
  createPerformanceStore,
  createFavoritesStore,
  createProfilesStore,
  createAppSettingsStore,
  createControlBindingsStore,
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

export type { CursorState, CursorActions, CursorAnchor } from '@pianel/core/store';
export { useCursorStore } from '@pianel/core/store';
export type { Scene, Song, SetlistEntry, Setlist } from '@pianel/core/store';
export {
  SongNotFoundError,
  SceneNotFoundError,
  SetlistNotFoundError,
  EntryNotFoundError,
  EmptySongError,
  EmptySetlistError,
  MissingSongError,
} from '@pianel/core/store';

export {
  useControlBindingsStore,
  useControlSurfaceStore,
  CONTROL_BINDINGS_VERSION,
} from '@pianel/core/store';

export type {
  Behaviour,
  ChannelMessageType,
  ControlMessageType,
  Edge,
  ChannelControlMessage,
  SysexControlMessage,
  ControlMessage,
  ChannelControlMatch,
  SysexControlMatch,
  ControlMatch,
  ControlAction,
  ControlBinding,
  ControlDevice,
  PeekHandle,
  ControlBindingsState,
  ControlBindingsActions,
  LearnPhase,
  LearnState,
  HeldControl,
  ControlSurfaceState,
  ControlSurfaceActions,
} from '@pianel/core/store';

let initialized = false;

export function initStores(storage: StateStorage): void {
  if (initialized) return;
  createConnectionStore({ storage });
  createPerformanceStore({ storage });
  createFavoritesStore({ storage });
  createProfilesStore({ storage });
  createAppSettingsStore({ storage });
  createControlBindingsStore({ storage });
  initialized = true;
}
