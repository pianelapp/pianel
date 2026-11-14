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
import {CURRENT_SCHEMA_VERSION} from '../../../src/types/schemaVersion';
import {normalizeProfile} from '../../../src/helpers/profileMigration';
import {applyExportFileDefaults} from '../../../src/services/profiles/ProfileService';
import type {ProfileExportFile} from '../../../src/types/profile';

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

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'prof-bbbbbbbbbbbb',
    name: 'Stage',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: 'light',
    accidentals: 'sharps',
    favorites: [] as FavoriteRef[],
    presets: [] as Preset[],
    songs: [],
    setlists: [],
    defaultState: {...DEFAULT_PERFORMANCE_SNAPSHOT},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function seedActive(profile: Profile): Profile {
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
    masterVolumeSide: 'right',
  });
});

describe('masterVolumeSide setting', () => {
  it('defaults to the right side', () => {
    expect(useAppSettingsStore.getInitialState().masterVolumeSide).toBe('right');
  });

  it('switches to the left side and back', () => {
    useAppSettingsStore.getState().setMasterVolumeSide('left');
    expect(useAppSettingsStore.getState().masterVolumeSide).toBe('left');
    useAppSettingsStore.getState().setMasterVolumeSide('right');
    expect(useAppSettingsStore.getState().masterVolumeSide).toBe('right');
  });
});

describe('ProfileService.syncActiveMasterVolumeSide', () => {
  it('writes only the side into the active profile and bumps updatedAt', () => {
    const service = newProfileService();
    const before = seedActive(makeProfile({masterVolumeSide: 'right'}));
    useAppSettingsStore.getState().setMasterVolumeSide('left');

    service.syncActiveMasterVolumeSide();

    const after = activeProfile();
    expect(after.masterVolumeSide).toBe('left');
    expect(after.updatedAt).not.toBe(before.updatedAt);
    expect(after.theme).toBe(before.theme);
    expect(after.accidentals).toBe(before.accidentals);
    expect(JSON.stringify(after.defaultState)).toBe(
      JSON.stringify(before.defaultState),
    );
  });

  it('is a safe no-op when there is no active profile', () => {
    const service = newProfileService();
    expect(() => service.syncActiveMasterVolumeSide()).not.toThrow();
    expect(useProfilesStore.getState().profiles).toHaveLength(0);
  });
});

describe('loading a profile', () => {
  it('applies the saved side', async () => {
    const service = newProfileService();
    const profile = seedActive(makeProfile({masterVolumeSide: 'left'}));
    await service.loadProfile(profile.id);
    expect(useAppSettingsStore.getState().masterVolumeSide).toBe('left');
  });

  it('falls back to the right side for a profile saved before the setting existed', async () => {
    const service = newProfileService();
    useAppSettingsStore.getState().setMasterVolumeSide('left');
    const profile = seedActive(makeProfile());
    await service.loadProfile(profile.id);
    expect(useAppSettingsStore.getState().masterVolumeSide).toBe('right');
  });
});

describe('creating and saving a profile', () => {
  it('captures the current side in a new profile', async () => {
    const service = newProfileService();
    useAppSettingsStore.getState().setMasterVolumeSide('left');
    const created = await service.createProfile('Church');
    expect(created.masterVolumeSide).toBe('left');
  });

  it('captures the current side when the profile is saved', async () => {
    const service = newProfileService();
    const profile = seedActive(makeProfile({masterVolumeSide: 'right'}));
    useAppSettingsStore.getState().setMasterVolumeSide('left');
    const updated = await service.updateProfile(profile.id);
    expect(updated.masterVolumeSide).toBe('left');
  });

  it('captures the current side in the Default profile', async () => {
    const service = newProfileService();
    useAppSettingsStore.getState().setMasterVolumeSide('left');
    const profile = await service.ensureDefaultProfile();
    expect(profile.masterVolumeSide).toBe('left');
  });
});

describe('older saved data', () => {
  it('leaves a stored profile without the field untouched', () => {
    const legacy = makeProfile();
    expect(normalizeProfile(legacy)).toEqual(legacy);
    expect('masterVolumeSide' in normalizeProfile(legacy)).toBe(false);
  });

  it('loads an unknown stored value as the right side', async () => {
    const service = newProfileService();
    useAppSettingsStore.getState().setMasterVolumeSide('left');
    const corrupted = {
      ...makeProfile(),
      masterVolumeSide: 'center',
    } as unknown as Profile;
    seedActive(corrupted);
    await service.loadProfile(corrupted.id);
    expect(useAppSettingsStore.getState().masterVolumeSide).toBe('right');
  });

  it('loads a v3 profile from local storage unchanged and opens the panel on the right', async () => {
    const v3 = {...makeProfile({theme: 'dark'}), schemaVersion: 3};
    const raw = JSON.stringify({
      state: {profiles: [v3], activeProfileId: v3.id},
      version: 0,
    });
    const storage = {
      getItem: (key: string) => (key === 'pianel:profiles' ? raw : null),
      setItem: () => {},
      removeItem: () => {},
    };
    createProfilesStore({storage});
    await useProfilesStore.persist.rehydrate();

    const loaded = useProfilesStore.getState().profiles[0];
    expect(loaded).toEqual({...v3, schemaVersion: CURRENT_SCHEMA_VERSION});
    expect('masterVolumeSide' in loaded).toBe(false);

    useAppSettingsStore.getState().setMasterVolumeSide('left');
    await newProfileService().loadProfile(loaded.id);
    expect(useAppSettingsStore.getState().masterVolumeSide).toBe('right');
    expect(useAppSettingsStore.getState().themePreference).toBe('dark');

    createProfilesStore({storage: inMemoryStorage});
  });

  it('fills the right side into an imported file without the field', () => {
    const file = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: '2026-01-02T00:00:00.000Z',
      profile: {id: '1700000000001-eeeeeeee', name: 'No Prefs'},
    } as unknown as ProfileExportFile;
    expect(applyExportFileDefaults(file).profile.masterVolumeSide).toBe('right');
  });

  it('keeps the left side from an imported file', () => {
    const file: ProfileExportFile = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: '2026-01-02T00:00:00.000Z',
      profile: makeProfile({masterVolumeSide: 'left'}),
    };
    expect(applyExportFileDefaults(file).profile.masterVolumeSide).toBe('left');
  });
});
