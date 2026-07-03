/**
 * ProfileService — owns profile lifecycle (create / update / rename / delete /
 * load), preset-grid manipulation through the active profile, and JSON
 * export/import (007-profiles-preset-pivot).
 *
 * Constitution V: lives in `packages/core`, depends only on other core
 * services + a `FilePickerAdapter` injected by the host app. Piano writes
 * delegate to `PianoService` via `PresetService` — no direct engine/transport
 * touches.
 */

import type {PianoService} from '../PianoService';
import {useAppSettingsStore} from '../../store/appSettingsStore';
import {useFavoritesStore} from '../../store/favoritesStore';
import {usePerformanceStore} from '../../store/performanceStore';
import {useProfilesStore} from '../../store/profilesStore';
import {generateProfileId, PROFILE_ID_PATTERN} from '../../helpers/profileId';
import {
  DEFAULT_PERFORMANCE_SNAPSHOT,
  type PerformanceSnapshot,
} from '../../types/performanceSnapshot';
import {
  DuplicateProfileNameError,
  MalformedProfileFileError,
  MAX_SUPPORTED_SCHEMA_VERSION,
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

// ─── Import result discriminated union ──────────────────────────

export type ImportResult =
  | {kind: 'imported'; profile: Profile}
  | {kind: 'conflict'; parsed: ProfileExportFile; existing: Profile}
  | {kind: 'cancelled'};

// ─── Forward-compatibility migrator table (R8) ─────────────────

const MIGRATORS: Record<number, (input: unknown) => ProfileExportFile> = {};

// ─── Service ────────────────────────────────────────────────────

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

  // ─── Lifecycle ───────────────────────────────────────────────

  async ensureDefaultProfile(): Promise<Profile> {
    const store = useProfilesStore.getState();
    const settings = useAppSettingsStore.getState();
    if (store.profiles.length > 0) {
      // If activeProfileId points at a missing profile, fall back to MRU.
      const active = store.profiles.find(p => p.id === store.activeProfileId);
      const resolved = active ?? mostRecentlyUpdated(store.profiles);
      if (!active) store.setActiveProfileId(resolved.id);

      // Repair bootProfileId if it's unset or stale.
      const bootValid = store.profiles.some(
        p => p.id === settings.bootProfileId,
      );
      if (!bootValid) settings.setBootProfileId(resolved.id);

      return resolved;
    }

    const now = new Date().toISOString();
    const defaultState = this.presetService.captureSnapshot();
    const profile: Profile = {
      id: generateProfileId(),
      name: 'Default',
      schemaVersion: 1,
      theme: settings.themePreference,
      accidentals: settings.accidentalPreference,
      favorites: snapshotFavorites(),
      presets: [],
      defaultState,
      createdAt: now,
      updatedAt: now,
    };
    store.addProfile(profile);
    store.setActiveProfileId(profile.id);
    settings.setBootProfileId(profile.id);
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
      schemaVersion: 1,
      theme: useAppSettingsStore.getState().themePreference,
      accidentals: useAppSettingsStore.getState().accidentalPreference,
      favorites: snapshotFavorites(),
      // New profile captures the *current* preset grid as its starting point —
      // documented under FR-012 "captures current state".
      presets: store.profiles.find(p => p.id === store.activeProfileId)?.presets
        ? [...(store.profiles.find(p => p.id === store.activeProfileId)?.presets ?? [])]
        : [],
      defaultState: this.presetService.captureSnapshot(),
      createdAt: now,
      updatedAt: now,
    };

    store.addProfile(profile);
    store.setActiveProfileId(profile.id); // FR-012 auto-activate.
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
    store.removeProfile(profileId);

    if (!wasActive) {
      if (wasBoot) settings.setBootProfileId(null);
      return {newActiveProfileId: store.activeProfileId};
    }

    const remaining = useProfilesStore.getState().profiles;
    if (remaining.length === 0) {
      // `ensureDefaultProfile` repoints bootProfileId to the freshly
      // created Default — no extra patch needed here.
      const recreated = await this.ensureDefaultProfile();
      return {newActiveProfileId: recreated.id};
    }
    const mru = mostRecentlyUpdated(remaining);
    store.setActiveProfileId(mru.id);
    if (wasBoot) settings.setBootProfileId(mru.id);
    return {newActiveProfileId: mru.id};
  }

  /**
   * Load a profile's *app-side configuration* — theme, accidentals,
   * favorites, quick-tone slot assignments — and mark it active.
   *
   * Intentionally does NOT touch the piano: no DT1 writes, no snapshot
   * apply, no pending-on-connect stash. If the user is playing when a
   * profile loads, the audio is undisturbed. To push state to the piano,
   * apply a preset (which is a deliberate, user-triggered action).
   */
  async loadProfile(profileId: string): Promise<void> {
    const store = useProfilesStore.getState();
    const profile = store.profiles.find(p => p.id === profileId);
    if (!profile) throw new ProfileNotFoundError(profileId);

    // 1. UI preferences.
    useAppSettingsStore.getState().setThemePreference(profile.theme);
    useAppSettingsStore.getState().setAccidentalPreference(profile.accidentals);

    // 2. Favorites — mirrored from the profile snapshot into the live store.
    replaceFavorites(profile.favorites);

    // 3. Quick-tone slot assignments — these live in `defaultState` for
    //    historical reasons (they're part of the captured snapshot) but
    //    they're UI buttons, not audible piano state, so restoring them
    //    here is safe.
    const slots = profile.defaultState?.quickToneSlots;
    if (slots) {
      const appSettings = useAppSettingsStore.getState();
      slots.forEach((slot, i) => {
        appSettings.setQuickToneSlot(i as 0 | 1 | 2, slot);
      });
    }

    // 4. Activate. The active profile's preset list flows to the UI via
    //    `selectActivePresets` — no extra wiring needed.
    store.setActiveProfileId(profileId);
  }

  // ─── Read accessors ──────────────────────────────────────────

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

  /** Write-through helper invoked by `useFavorites` after a favorites edit so
   *  the active profile's `favorites` mirror stays in sync (data-model §5). */
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

  /**
   * Narrow per-field write-back: persist only the active profile's `theme`
   * (plus `updatedAt`) from the live app-settings store. Mirrors
   * `syncActiveFavorites` — it MUST NOT recapture `defaultState` or touch
   * `presets`/`favorites` (009-settings-preferences, Requirements 3.2/3.3/3.7).
   * No-ops when there is no active profile.
   */
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

  /**
   * Narrow per-field write-back: persist only the active profile's
   * `accidentals` (plus `updatedAt`) from the live app-settings store. Mirrors
   * `syncActiveFavorites` — it MUST NOT recapture `defaultState` or touch
   * `presets`/`favorites` (009-settings-preferences, Requirements 6.2/6.3/6.7).
   * No-ops when there is no active profile.
   */
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

  // ─── Preset-grid operations (scoped to active profile) ───────

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

  // ─── Export / Import ─────────────────────────────────────────

  async exportProfile(profileId: string): Promise<{saved: boolean}> {
    const profile = this.getProfileById(profileId);
    if (!profile) throw new ProfileNotFoundError(profileId);

    const file: ProfileExportFile = {
      schemaVersion: 1,
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

    // No ID collision: handle name conflict via " (Imported)" suffix.
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
      // Re-apply defaultState since the active profile's snapshot changed.
      await this.loadProfile(filled.profile.id);
    }
    return filled.profile;
  }

  // ─── Internals ────────────────────────────────────────────────

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

    // schemaVersion defaults to 1 if missing (R2).
    const schemaVersion =
      typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1;
    if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
      throw new MalformedProfileFileError('invalid schemaVersion');
    }
    if (schemaVersion > MAX_SUPPORTED_SCHEMA_VERSION) {
      throw new UnsupportedProfileVersionError(schemaVersion);
    }
    if (schemaVersion < MAX_SUPPORTED_SCHEMA_VERSION) {
      const migrator = MIGRATORS[schemaVersion];
      if (!migrator) {
        throw new MalformedProfileFileError(
          `no migrator for schemaVersion ${schemaVersion}`,
        );
      }
      return migrator(input);
    }

    // schemaVersion === MAX_SUPPORTED. Validate the profile shape.
    const profile = obj.profile;
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
      schemaVersion: 1,
      exportedAt:
        typeof obj.exportedAt === 'string'
          ? obj.exportedAt
          : new Date().toISOString(),
      profile: profile as Profile,
    };
  }
}

// ─── Helpers ───────────────────────────────────────────────────

function snapshotFavorites(): FavoriteRef[] {
  return useFavoritesStore
    .getState()
    .favorites.map((f, sortOrder) => ({toneId: f.toneId, sortOrder}));
}

function replaceFavorites(refs: FavoriteRef[]): void {
  // Replace the contents of useFavoritesStore by removing every existing
  // entry then re-adding in `sortOrder` order. This keeps the existing store
  // API (no `replace` action) intact.
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

/**
 * Apply documented defaults (data-model §9) to any missing field in a parsed
 * ProfileExportFile. Used both for the no-conflict import path and for
 * `confirmImportOverwrite`.
 */
export function applyExportFileDefaults(
  parsed: ProfileExportFile,
): ProfileExportFile {
  const p = parsed.profile;
  const filledSnapshot = applySnapshotDefaults(p.defaultState);
  const filled: Profile = {
    id: p.id,
    name: p.name,
    schemaVersion: 1,
    theme: p.theme ?? 'system',
    accidentals: p.accidentals ?? 'sharps',
    favorites: Array.isArray(p.favorites) ? p.favorites : [],
    presets: Array.isArray(p.presets)
      ? p.presets.map(applyPresetDefaults)
      : [],
    defaultState: filledSnapshot,
    createdAt: p.createdAt ?? new Date().toISOString(),
    updatedAt: p.updatedAt ?? new Date().toISOString(),
  };
  return {
    schemaVersion: 1,
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

/**
 * Pick a name that doesn't collide with the supplied set. On first collision
 * append `" (Imported)"`; subsequent collisions append `" (Imported N)"` with
 * N starting at 2.
 */
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

// ─── Suppress unused-perf-import warnings when not yet wired ───
// `usePerformanceStore` will be used once `replayPendingOnConnect` hook
// integration lands in App bootstrap. Mark a no-op reference so linters
// don't strip the import (we may need it for pendingTone integration).
void usePerformanceStore;
