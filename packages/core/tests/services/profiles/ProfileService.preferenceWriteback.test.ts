/**
 * 009-settings-preferences Task 1 — ProfileService narrow per-field write-back.
 *
 * Covers `syncActiveTheme` / `syncActiveAccidentals`:
 *  - Writing back the theme updates only the active profile's `theme` and
 *    `updatedAt`; accidentals updates only `accidentals` and `updatedAt`.
 *  - `defaultState`, `presets`, and `favorites` are byte-identical (deep-equal)
 *    before and after each write-back — i.e. it does NOT behave like a full
 *    `updateProfile` snapshot capture (Requirements 3.3 / 6.3).
 *  - No-active-profile case is a safe no-op (mirrors `syncActiveFavorites`).
 *  - The write-back reads the value from the live app settings store so store
 *    and profile stay in agreement (Requirements 3.2 / 6.2 / 7.5).
 */

import {ProfileService} from '../../../src/services/profiles/ProfileService';
import {PresetService} from '../../../src/services/presets/PresetService';
import {PianoService} from '../../../src/services/PianoService';
import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {createProfilesStore, useProfilesStore} from '../../../src/store/profilesStore';
import {createPerformanceStore} from '../../../src/store/performanceStore';
import {createAppSettingsStore, useAppSettingsStore} from '../../../src/store/appSettingsStore';
import {createFavoritesStore} from '../../../src/store/favoritesStore';
import {createConnectionStore} from '../../../src/store/connectionStore';
import {inMemoryStorage} from '../../../src/store/storage';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import type {Profile, Preset, FavoriteRef} from '../../../src/types/profile';
import type {Transport} from '../../../src/transport/types';
import type {FilePickerAdapter} from '../../../src/services/profiles/FilePickerAdapter';

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

const fakePicker: FilePickerAdapter = {
  async openProfileJson() {
    return null;
  },
  async saveProfileJson() {
    return false;
  },
};

function newProfileService(): ProfileService {
  const transport = new FakeTransport();
  const pianoService = new PianoService(transport);
  pianoService.setEngine(new FP30XEngine());
  const presetService = new PresetService(pianoService);
  return new ProfileService(pianoService, fakePicker, presetService);
}

function makePresets(): Preset[] {
  return [
    {
      id: 'prst-aaaaaaaaaaaa',
      label: 'Grand',
      tilePosition: 0,
      snapshot: {...DEFAULT_PERFORMANCE_SNAPSHOT, volume: 42},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
}

function makeFavorites(): FavoriteRef[] {
  return [
    {toneId: 'tone-1', sortOrder: 0},
    {toneId: 'tone-2', sortOrder: 1},
  ];
}

function seedActiveProfile(overrides: Partial<Profile> = {}): Profile {
  const profile: Profile = {
    id: 'prof-bbbbbbbbbbbb',
    name: 'Stage',
    schemaVersion: 1,
    theme: 'light',
    accidentals: 'sharps',
    favorites: makeFavorites(),
    presets: makePresets(),
    defaultState: {...DEFAULT_PERFORMANCE_SNAPSHOT, tempo: 96},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  useProfilesStore.setState({profiles: [profile], activeProfileId: profile.id});
  return profile;
}

function activeProfile(): Profile {
  const {profiles, activeProfileId} = useProfilesStore.getState();
  return profiles.find(p => p.id === activeProfileId)!;
}

beforeAll(() => {
  createProfilesStore({storage: inMemoryStorage});
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
  createFavoritesStore({storage: inMemoryStorage});
  createConnectionStore({storage: inMemoryStorage});
});

beforeEach(() => {
  useProfilesStore.setState({profiles: [], activeProfileId: ''});
  useAppSettingsStore.setState({
    themePreference: 'system',
    accidentalPreference: 'sharps',
  });
});

describe('ProfileService.syncActiveTheme', () => {
  it('writes only the active profile theme from the live store + bumps updatedAt', () => {
    const service = newProfileService();
    const before = seedActiveProfile({theme: 'light'});
    useAppSettingsStore.getState().setThemePreference('dark');

    service.syncActiveTheme();

    const after = activeProfile();
    expect(after.theme).toBe('dark');
    expect(after.updatedAt).not.toBe(before.updatedAt);
  });

  it('leaves defaultState, presets and favorites byte-identical', () => {
    const service = newProfileService();
    const before = seedActiveProfile({theme: 'light'});
    const snapDefault = JSON.stringify(before.defaultState);
    const snapPresets = JSON.stringify(before.presets);
    const snapFavorites = JSON.stringify(before.favorites);
    useAppSettingsStore.getState().setThemePreference('dark');

    service.syncActiveTheme();

    const after = activeProfile();
    expect(JSON.stringify(after.defaultState)).toBe(snapDefault);
    expect(JSON.stringify(after.presets)).toBe(snapPresets);
    expect(JSON.stringify(after.favorites)).toBe(snapFavorites);
    // accidentals untouched on the theme path
    expect(after.accidentals).toBe(before.accidentals);
  });

  it('is a safe no-op when there is no active profile', () => {
    const service = newProfileService();
    useProfilesStore.setState({profiles: [], activeProfileId: ''});
    expect(() => service.syncActiveTheme()).not.toThrow();
    expect(useProfilesStore.getState().profiles).toHaveLength(0);
  });
});

describe('ProfileService.syncActiveAccidentals', () => {
  it('writes only the active profile accidentals from the live store + bumps updatedAt', () => {
    const service = newProfileService();
    const before = seedActiveProfile({accidentals: 'sharps'});
    useAppSettingsStore.getState().setAccidentalPreference('flats');

    service.syncActiveAccidentals();

    const after = activeProfile();
    expect(after.accidentals).toBe('flats');
    expect(after.updatedAt).not.toBe(before.updatedAt);
  });

  it('leaves defaultState, presets and favorites byte-identical', () => {
    const service = newProfileService();
    const before = seedActiveProfile({accidentals: 'sharps'});
    const snapDefault = JSON.stringify(before.defaultState);
    const snapPresets = JSON.stringify(before.presets);
    const snapFavorites = JSON.stringify(before.favorites);
    useAppSettingsStore.getState().setAccidentalPreference('flats');

    service.syncActiveAccidentals();

    const after = activeProfile();
    expect(JSON.stringify(after.defaultState)).toBe(snapDefault);
    expect(JSON.stringify(after.presets)).toBe(snapPresets);
    expect(JSON.stringify(after.favorites)).toBe(snapFavorites);
    // theme untouched on the accidentals path
    expect(after.theme).toBe(before.theme);
  });

  it('is a safe no-op when there is no active profile', () => {
    const service = newProfileService();
    useProfilesStore.setState({profiles: [], activeProfileId: ''});
    expect(() => service.syncActiveAccidentals()).not.toThrow();
    expect(useProfilesStore.getState().profiles).toHaveLength(0);
  });

  it('keeps store and profile in agreement after the write-back', () => {
    const service = newProfileService();
    seedActiveProfile({accidentals: 'sharps'});
    useAppSettingsStore.getState().setAccidentalPreference('flats');

    service.syncActiveAccidentals();

    expect(activeProfile().accidentals).toBe(
      useAppSettingsStore.getState().accidentalPreference,
    );
  });
});
