export type {StateStorage} from './storage';
export {inMemoryStorage} from './storage';

export type {
  ConnectionStatus,
  ConnectionState,
  ConnectionActions,
  DiscoveredDevice,
} from './connectionStore';
export {useConnectionStore, createConnectionStore} from './connectionStore';

export type {PerformanceState, PerformanceActions} from './performanceStore';
export {usePerformanceStore, createPerformanceStore} from './performanceStore';

export type {FavoriteTone, FavoritesState, FavoritesActions} from './favoritesStore';
export {useFavoritesStore, createFavoritesStore} from './favoritesStore';

export {usePresetsStore, getActivePresets} from './presetsStore';

export type {ProfilesState, ProfilesActions} from './profilesStore';
export {
  useProfilesStore,
  createProfilesStore,
  selectActiveProfile,
  selectActivePresets,
} from './profilesStore';

export type {
  Profile,
  Preset,
  ProfileExportFile,
  FavoriteRef,
} from '../types/profile';
export {
  PRESET_TILE_COUNT,
  MAX_SUPPORTED_SCHEMA_VERSION,
  DuplicateProfileNameError,
  ProfileNotFoundError,
  MalformedProfileFileError,
  UnsupportedProfileVersionError,
  PresetGridFullError,
} from '../types/profile';

export type {PerformanceSnapshot} from '../types/performanceSnapshot';
export {DEFAULT_PERFORMANCE_SNAPSHOT} from '../types/performanceSnapshot';

export type {ThemePreference, AccidentalPreference, AppSettingsState, AppSettingsActions} from './appSettingsStore';
export {useAppSettingsStore, createAppSettingsStore} from './appSettingsStore';
