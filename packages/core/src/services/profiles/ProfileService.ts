import type {PianoService} from '../PianoService';
import {useAppSettingsStore} from '../../store/appSettingsStore';
import {useFavoritesStore} from '../../store/favoritesStore';
import {usePerformanceStore} from '../../store/performanceStore';
import {useProfilesStore} from '../../store/profilesStore';
import {generateProfileId, PROFILE_ID_PATTERN} from '../../helpers/profileId';
import {
  migrateToCurrent,
  MissingMigratorError,
  OLDEST_SCHEMA_VERSION,
} from '../../helpers/schemaHistory';
import {
  DEFAULT_PERFORMANCE_SNAPSHOT,
  type PerformanceSnapshot,
} from '../../types/performanceSnapshot';
import {CURRENT_SCHEMA_VERSION} from '../../types/schemaVersion';
import {
  DuplicateProfileNameError,
  MalformedProfileFileError,
  PresetGridFullError,
  PRESET_TILE_COUNT,
  ProfileNotFoundError,
  UnsupportedProfileVersionError,
  type FavoriteRef,
  type Preset,
  type Profile,
  type ProfileExportFile,
} from '../../types/profile';
import type {FilePickerAdapter} from './FilePickerAdapter';
import {PresetService, sanitizeFilename} from '../presets/PresetService';

export type ImportResult =
  | {kind: 'imported'; profile: Profile}
  | {kind: 'conflict'; parsed: ProfileExportFile; existing: Profile}
  | {kind: 'cancelled'};

export class ProfileService {
  private pianoService: PianoService;
  private filePicker: FilePickerAdapter;
  private presetService: PresetService;

  constructor(
    pianoService: PianoService,
    filePicker: FilePickerAdapter,
    presetService: PresetService,
  ) {
    this.pianoService = pianoService;
    this.filePicker = filePicker;
    this.presetService = presetService;
  }

  async ensureDefaultProfile(): Promise<Profile> {
    const store = useProfilesStore.getState();
    const settings = useAppSettingsStore.getState();
    if (store.profiles.length > 0) {
      const active = store.profiles.find(p => p.id === store.activeProfileId);
      const resolved = active ?? mostRecentlyUpdated(store.profiles);
      if (!active) store.setActiveProfileId(resolved.id);

      const bootValid = store.profiles.some(
        p => p.id === settings.bootProfileId,
      );
      if (!bootValid) settings.setBootProfileId(resolved.id);

      return resolved;
    }

    const profile = this._addDefaultProfile();
    store.setActiveProfileId(profile.id);
    settings.setBootProfileId(profile.id);
    return profile;
  }

  private _addDefaultProfile(): Profile {
    const now = new Date().toISOString();
    const settings = useAppSettingsStore.getState();
    const profile: Profile = {
      id: generateProfileId(),
      name: 'Default',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      theme: settings.themePreference,
      accidentals: settings.accidentalPreference,
      favorites: snapshotFavorites(),
      presets: [],
      songs: [],
      setlists: [],
      defaultState: this.presetService.captureSnapshot(),
      createdAt: now,
      updatedAt: now,
    };
    useProfilesStore.getState().addProfile(profile);
    return profile;
  }

  async createProfile(name: string): Promise<Profile> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Profile name cannot be empty.');

    const store = useProfilesStore.getState();
    if (store.profiles.some(p => p.name === trimmed)) {
      throw new DuplicateProfileNameError(trimmed);
    }

    const now = new Date().toISOString();
    const profile: Profile = {
      id: generateProfileId(),
      name: trimmed,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      theme: useAppSettingsStore.getState().themePreference,
      accidentals: useAppSettingsStore.getState().accidentalPreference,
      favorites: snapshotFavorites(),
      presets: store.profiles.find(p => p.id === store.activeProfileId)?.presets
        ? [...(store.profiles.find(p => p.id === store.activeProfileId)?.presets ?? [])]
        : [],
      songs: [],
      setlists: [],
      defaultState: this.presetService.captureSnapshot(),
      createdAt: now,
      updatedAt: now,
    };

    store.addProfile(profile);
    store.setActiveProfileId(profile.id);
    return profile;
  }

  async updateProfile(
    profileId: string,
    opts?: {name?: string},
  ): Promise<Profile> {
    const store = useProfilesStore.getState();
    const existing = store.profiles.find(p => p.id === profileId);
    if (!existing) throw new ProfileNotFoundError(profileId);

    let newName = existing.name;
    if (opts?.name !== undefined) {
      const trimmed = opts.name.trim();
      if (!trimmed) throw new Error('Profile name cannot be empty.');
      if (
        trimmed !== existing.name &&
        store.profiles.some(p => p.id !== profileId && p.name === trimmed)
      ) {
        throw new DuplicateProfileNameError(trimmed);
      }
      newName = trimmed;
    }

    const updated: Profile = {
      ...existing,
      name: newName,
      theme: useAppSettingsStore.getState().themePreference,
      accidentals: useAppSettingsStore.getState().accidentalPreference,
      favorites: snapshotFavorites(),
      defaultState: this.presetService.captureSnapshot(),
      updatedAt: new Date().toISOString(),
    };
    store.updateProfileInList(updated);
    return updated;
  }

  async renameProfile(profileId: string, newName: string): Promise<Profile> {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Profile name cannot be empty.');

    const store = useProfilesStore.getState();
    const existing = store.profiles.find(p => p.id === profileId);
    if (!existing) throw new ProfileNotFoundError(profileId);

    if (
      trimmed !== existing.name &&
      store.profiles.some(p => p.id !== profileId && p.name === trimmed)
    ) {
      throw new DuplicateProfileNameError(trimmed);
    }

    store.renameProfileInList(profileId, trimmed);
    return useProfilesStore.getState().profiles.find(p => p.id === profileId)!;
  }

  async deleteProfile(
    profileId: string,
  ): Promise<{newActiveProfileId: string}> {
    const store = useProfilesStore.getState();
    const existing = store.profiles.find(p => p.id === profileId);
    if (!existing) throw new ProfileNotFoundError(profileId);

    const wasActive = store.activeProfileId === profileId;
    const settings = useAppSettingsStore.getState();
    const wasBoot = settings.bootProfileId === profileId;

    if (!wasActive) {
      store.removeProfile(profileId);
      if (wasBoot) settings.setBootProfileId(null);
      return {newActiveProfileId: useProfilesStore.getState().activeProfileId};
    }

    const remaining = store.profiles.filter(p => p.id !== profileId);
    const isLast = remaining.length === 0;
    const next = isLast ? this._addDefaultProfile() : mostRecentlyUpdated(remaining);

    store.setActiveProfileId(next.id);
    if (wasBoot || isLast) settings.setBootProfileId(next.id);
    store.removeProfile(profileId);
    return {newActiveProfileId: next.id};
  }

  async loadProfile(profileId: string): Promise<void> {
    const store = useProfilesStore.getState();
    const profile = store.profiles.find(p => p.id === profileId);
    if (!profile) throw new ProfileNotFoundError(profileId);

    useAppSettingsStore.getState().setThemePreference(profile.theme);
    useAppSettingsStore.getState().setAccidentalPreference(profile.accidentals);

    replaceFavorites(profile.favorites);

    const slots = profile.defaultState?.quickToneSlots;
    if (slots) {
      const appSettings = useAppSettingsStore.getState();
      slots.forEach((slot, i) => {
        appSettings.setQuickToneSlot(i as 0 | 1 | 2, slot);
      });
    }

    store.setActiveProfileId(profileId);
  }

  getActiveProfile(): Profile | null {
    const store = useProfilesStore.getState();
    return store.profiles.find(p => p.id === store.activeProfileId) ?? null;
  }

  getProfileById(profileId: string): Profile | null {
    return (
      useProfilesStore.getState().profiles.find(p => p.id === profileId) ?? null
    );
  }

  listProfiles(): Profile[] {
    return [...useProfilesStore.getState().profiles].sort((a, b) =>
      a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
    );
  }

  syncActiveFavorites(): void {
    const store = useProfilesStore.getState();
    const active = store.profiles.find(p => p.id === store.activeProfileId);
    if (!active) return;
    const next: Profile = {
      ...active,
      favorites: snapshotFavorites(),
      updatedAt: new Date().toISOString(),
    };
    store.updateProfileInList(next);
  }

  syncActiveTheme(): void {
    const store = useProfilesStore.getState();
    const active = store.profiles.find(p => p.id === store.activeProfileId);
    if (!active) return;
    const next: Profile = {
      ...active,
      theme: useAppSettingsStore.getState().themePreference,
      updatedAt: new Date().toISOString(),
    };
    store.updateProfileInList(next);
  }

  syncActiveAccidentals(): void {
    const store = useProfilesStore.getState();
    const active = store.profiles.find(p => p.id === store.activeProfileId);
    if (!active) return;
    const next: Profile = {
      ...active,
      accidentals: useAppSettingsStore.getState().accidentalPreference,
      updatedAt: new Date().toISOString(),
    };
    store.updateProfileInList(next);
  }

  async savePresetToTile(tilePosition: number, label: string): Promise<Preset> {
    if (tilePosition < 0 || tilePosition >= PRESET_TILE_COUNT) {
      throw new Error(
        `tilePosition ${tilePosition} out of range [0, ${PRESET_TILE_COUNT - 1}].`,
      );
    }
    const trimmed = label.trim();
    if (!trimmed) throw new Error('Preset label cannot be empty.');

    const active = this._getActiveProfileOrThrow();
    if (active.presets.some(p => p.tilePosition === tilePosition)) {
      throw new PresetGridFullError(tilePosition);
    }

    const now = new Date().toISOString();
    const preset: Preset = {
      id: generateProfileId(),
      label: trimmed,
      tilePosition,
      snapshot: this.presetService.captureSnapshot(),
      createdAt: now,
      updatedAt: now,
    };

    this._writeActiveProfile(profile => ({
      ...profile,
      presets: [...profile.presets, preset],
      updatedAt: now,
    }));

    return preset;
  }

  async applyPreset(presetId: string): Promise<void> {
    const active = this._getActiveProfileOrThrow();
    const preset = active.presets.find(p => p.id === presetId);
    if (!preset) throw new Error(`No preset with id "${presetId}".`);
    await this.presetService.applyPreset(preset);
  }

  async updatePreset(
    presetId: string,
    opts?: {label?: string},
  ): Promise<Preset> {
    const active = this._getActiveProfileOrThrow();
    const idx = active.presets.findIndex(p => p.id === presetId);
    if (idx < 0) throw new Error(`No preset with id "${presetId}".`);

    let nextLabel = active.presets[idx].label;
    if (opts?.label !== undefined) {
      const trimmed = opts.label.trim();
      if (!trimmed) throw new Error('Preset label cannot be empty.');
      nextLabel = trimmed;
    }
    const now = new Date().toISOString();
    const next: Preset = {
      ...active.presets[idx],
      label: nextLabel,
      snapshot: this.presetService.captureSnapshot(),
      updatedAt: now,
    };
    this._writeActiveProfile(profile => ({
      ...profile,
      presets: profile.presets.map(p => (p.id === presetId ? next : p)),
      updatedAt: now,
    }));
    return next;
  }

  async renamePreset(presetId: string, newLabel: string): Promise<Preset> {
    const trimmed = newLabel.trim();
    if (!trimmed) throw new Error('Preset label cannot be empty.');

    const active = this._getActiveProfileOrThrow();
    const existing = active.presets.find(p => p.id === presetId);
    if (!existing) throw new Error(`No preset with id "${presetId}".`);

    const now = new Date().toISOString();
    const next: Preset = {...existing, label: trimmed, updatedAt: now};
    this._writeActiveProfile(profile => ({
      ...profile,
      presets: profile.presets.map(p => (p.id === presetId ? next : p)),
      updatedAt: now,
    }));
    return next;
  }

  async deletePreset(presetId: string): Promise<void> {
    const active = this._getActiveProfileOrThrow();
    if (!active.presets.some(p => p.id === presetId)) {
      throw new Error(`No preset with id "${presetId}".`);
    }
    const now = new Date().toISOString();
    this._writeActiveProfile(profile => ({
      ...profile,
      presets: profile.presets.filter(p => p.id !== presetId),
      updatedAt: now,
    }));
  }

  async exportProfile(profileId: string): Promise<{saved: boolean}> {
    const profile = this.getProfileById(profileId);
    if (!profile) throw new ProfileNotFoundError(profileId);

    const file: ProfileExportFile = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      profile,
    };
    const contents = JSON.stringify(file, null, 2);
    const filename = `${sanitizeFilename(profile.name) || 'profile'}.pianel-profile.json`;
    const saved = await this.filePicker.saveProfileJson(filename, contents);
    return {saved};
  }

  async importProfile(): Promise<ImportResult> {
    const raw = await this.filePicker.openProfileJson();
    if (raw === null) return {kind: 'cancelled'};

    let parsedUnknown: unknown;
    try {
      parsedUnknown = JSON.parse(raw);
    } catch {
      throw new MalformedProfileFileError('not valid JSON');
    }

    const parsed = this._validateAndMigrate(parsedUnknown);
    const filled = applyExportFileDefaults(parsed);

    const store = useProfilesStore.getState();
    const existing = store.profiles.find(p => p.id === filled.profile.id);
    if (existing) {
      return {kind: 'conflict', parsed: filled, existing};
    }

    const finalProfile = {
      ...filled.profile,
      name: uniqueImportName(filled.profile.name, store.profiles.map(p => p.name)),
    };
    store.addProfile(finalProfile);
    return {kind: 'imported', profile: finalProfile};
  }

  async confirmImportOverwrite(parsed: ProfileExportFile): Promise<Profile> {
    const filled = applyExportFileDefaults(parsed);
    const store = useProfilesStore.getState();
    store.replaceProfileById(filled.profile);

    if (store.activeProfileId === filled.profile.id) {
      await this.loadProfile(filled.profile.id);
    }
    return filled.profile;
  }

  private _getActiveProfileOrThrow(): Profile {
    const active = this.getActiveProfile();
    if (!active) {
      throw new Error(
        'No active profile — ensureDefaultProfile() must run during bootstrap.',
      );
    }
    return active;
  }

  private _writeActiveProfile(mutator: (profile: Profile) => Profile): void {
    const active = this._getActiveProfileOrThrow();
    useProfilesStore.getState().updateProfileInList(mutator(active));
  }

  private _validateAndMigrate(input: unknown): ProfileExportFile {
    if (!input || typeof input !== 'object') {
      throw new MalformedProfileFileError('top-level value is not an object');
    }
    const obj = input as Record<string, unknown>;

    const schemaVersion =
      typeof obj.schemaVersion === 'number'
        ? obj.schemaVersion
        : OLDEST_SCHEMA_VERSION;
    if (
      !Number.isInteger(schemaVersion) ||
      schemaVersion < OLDEST_SCHEMA_VERSION
    ) {
      throw new MalformedProfileFileError('invalid schemaVersion');
    }
    if (schemaVersion > CURRENT_SCHEMA_VERSION) {
      throw new UnsupportedProfileVersionError(schemaVersion);
    }

    let candidate: Record<string, unknown> = obj;
    if (schemaVersion < CURRENT_SCHEMA_VERSION) {
      try {
        candidate = migrateToCurrent(obj, schemaVersion);
      } catch (error) {
        if (!(error instanceof MissingMigratorError)) throw error;
        throw new MalformedProfileFileError(error.message);
      }
    }

    const profile = candidate.profile;
    if (!profile || typeof profile !== 'object') {
      throw new MalformedProfileFileError('missing profile object');
    }
    const p = profile as Record<string, unknown>;
    if (typeof p.id !== 'string' || !PROFILE_ID_PATTERN.test(p.id)) {
      throw new MalformedProfileFileError('invalid profile id');
    }
    if (typeof p.name !== 'string' || p.name.trim() === '') {
      throw new MalformedProfileFileError('profile name must be non-empty');
    }
    if (p.presets !== undefined && !Array.isArray(p.presets)) {
      throw new MalformedProfileFileError('presets must be an array');
    }

    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt:
        typeof candidate.exportedAt === 'string'
          ? candidate.exportedAt
          : new Date().toISOString(),
      profile: profile as Profile,
    };
  }
}

function snapshotFavorites(): FavoriteRef[] {
  return useFavoritesStore
    .getState()
    .favorites.map((f, sortOrder) => ({toneId: f.toneId, sortOrder}));
}

function replaceFavorites(refs: FavoriteRef[]): void {
  const store = useFavoritesStore.getState();
  const existingIds = store.favorites.map(f => f.toneId);
  existingIds.forEach(id => store.removeFavorite(id));
  [...refs]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach(ref => store.addFavorite(ref.toneId));
}

function mostRecentlyUpdated(profiles: Profile[]): Profile {
  return [...profiles].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  )[0];
}

export function applyExportFileDefaults(
  parsed: ProfileExportFile,
): ProfileExportFile {
  const p = parsed.profile;
  const filledSnapshot = applySnapshotDefaults(p.defaultState);
  const filled: Profile = {
    id: p.id,
    name: p.name,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: p.theme ?? 'system',
    accidentals: p.accidentals ?? 'sharps',
    favorites: Array.isArray(p.favorites) ? p.favorites : [],
    presets: Array.isArray(p.presets)
      ? p.presets.map(applyPresetDefaults)
      : [],
    songs: Array.isArray(p.songs) ? p.songs : [],
    setlists: Array.isArray(p.setlists) ? p.setlists : [],
    defaultState: filledSnapshot,
    createdAt: p.createdAt ?? new Date().toISOString(),
    updatedAt: p.updatedAt ?? new Date().toISOString(),
  };
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: parsed.exportedAt ?? new Date().toISOString(),
    profile: filled,
  };
}

function applyPresetDefaults(p: Partial<Preset>): Preset {
  return {
    id: p.id ?? generateProfileId(),
    label: p.label ?? 'Untitled',
    tilePosition: typeof p.tilePosition === 'number' ? p.tilePosition : 0,
    snapshot: applySnapshotDefaults(p.snapshot),
    createdAt: p.createdAt ?? new Date().toISOString(),
    updatedAt: p.updatedAt ?? new Date().toISOString(),
  };
}

function applySnapshotDefaults(
  snap?: Partial<PerformanceSnapshot>,
): PerformanceSnapshot {
  const d = DEFAULT_PERFORMANCE_SNAPSHOT;
  if (!snap) return {...d, metronome: {...d.metronome}, quickToneSlots: [...d.quickToneSlots] as PerformanceSnapshot['quickToneSlots']};
  return {
    volume: typeof snap.volume === 'number' ? snap.volume : d.volume,
    tempo: typeof snap.tempo === 'number' ? snap.tempo : d.tempo,
    metronome:
      snap.metronome && typeof snap.metronome === 'object'
        ? {...snap.metronome}
        : {...d.metronome},
    voiceModeSnapshot: snap.voiceModeSnapshot ?? {...d.voiceModeSnapshot},
    currentToneId:
      snap.currentToneId === undefined ? d.currentToneId : snap.currentToneId,
    quickToneSlots: Array.isArray(snap.quickToneSlots) && snap.quickToneSlots.length === 3
      ? (snap.quickToneSlots as PerformanceSnapshot['quickToneSlots'])
      : ([...d.quickToneSlots] as PerformanceSnapshot['quickToneSlots']),
  };
}

export function uniqueImportName(
  desired: string,
  existing: string[],
): string {
  if (!existing.includes(desired)) return desired;

  const first = `${desired} (Imported)`;
  if (!existing.includes(first)) return first;

  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `${desired} (Imported ${n})`;
    if (!existing.includes(candidate)) return candidate;
    n += 1;
  }
}

void usePerformanceStore;
