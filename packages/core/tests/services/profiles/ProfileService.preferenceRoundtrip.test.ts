/**
 * 009-settings-preferences Task 7.1 / 7.2 — relaunch agreement, profile-switch
 * round-trip, and export/import carry-over for theme + accidentals.
 *
 * Requirements 3.4/3.5/3.6, 6.4/6.5/6.6, 7.1/7.2/7.3/7.6/7.7:
 *  - Change theme/accidentals via the narrow write-back, then simulate a
 *    relaunch (`loadProfile` re-run) → no divergent value (store ↔ profile).
 *  - Switching the active profile applies the newly active profile's theme and
 *    accidentals into the store.
 *  - Export then re-import carries theme + accidentals with no regression.
 */
import {ProfileService, applyExportFileDefaults} from '../../../src/services/profiles/ProfileService';
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
import type {Profile, ProfileExportFile} from '../../../src/types/profile';
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

let savedJson: string | null = null;
let openJson: string | null = null;

const picker: FilePickerAdapter = {
  async openProfileJson() {
    return openJson;
  },
  async saveProfileJson(_filename, contents) {
    savedJson = contents;
    return true;
  },
};

function newService(): ProfileService {
  const transport = new FakeTransport();
  const pianoService = new PianoService(transport);
  pianoService.setEngine(new FP30XEngine());
  const presetService = new PresetService(pianoService);
  return new ProfileService(pianoService, picker, presetService);
}

function makeProfile(id: string, overrides: Partial<Profile> = {}): Profile {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id,
    name: id,
    schemaVersion: 1,
    theme: 'system',
    accidentals: 'sharps',
    favorites: [],
    presets: [],
    defaultState: {...DEFAULT_PERFORMANCE_SNAPSHOT},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
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
  useAppSettingsStore.setState({themePreference: 'system', accidentalPreference: 'sharps'});
  savedJson = null;
  openJson = null;
});

describe('relaunch agreement (Req 3.7 / 6.7)', () => {
  it('change + write-back + simulated relaunch reveals no divergent value', async () => {
    const service = newService();
    const profile = makeProfile('prof-aaaaaaaaaaaa', {theme: 'system', accidentals: 'sharps'});
    useProfilesStore.setState({profiles: [profile], activeProfileId: profile.id});

    // User changes both preferences (store first, then narrow write-back).
    useAppSettingsStore.getState().setThemePreference('dark');
    service.syncActiveTheme();
    useAppSettingsStore.getState().setAccidentalPreference('flats');
    service.syncActiveAccidentals();

    // Simulate relaunch: clear the live store, then loadProfile re-applies.
    useAppSettingsStore.setState({themePreference: 'system', accidentalPreference: 'sharps'});
    await service.loadProfile(profile.id);

    expect(useAppSettingsStore.getState().themePreference).toBe('dark');
    expect(useAppSettingsStore.getState().accidentalPreference).toBe('flats');
  });
});

describe('profile-switch round-trip (Req 7.1 / 7.3)', () => {
  it('switching the active profile applies its theme and accidentals to the store', async () => {
    const service = newService();
    const a = makeProfile('prof-aaaaaaaaaaaa', {theme: 'light', accidentals: 'sharps'});
    const b = makeProfile('prof-bbbbbbbbbbbb', {theme: 'dark', accidentals: 'flats'});
    useProfilesStore.setState({profiles: [a, b], activeProfileId: a.id});

    await service.loadProfile(a.id);
    expect(useAppSettingsStore.getState().themePreference).toBe('light');
    expect(useAppSettingsStore.getState().accidentalPreference).toBe('sharps');

    await service.loadProfile(b.id);
    expect(useAppSettingsStore.getState().themePreference).toBe('dark');
    expect(useAppSettingsStore.getState().accidentalPreference).toBe('flats');
  });
});

describe('export / import carries theme + accidentals (Req 3.4 / 6.4 / 7.7)', () => {
  it('exported file preserves theme and accidentals', async () => {
    const service = newService();
    const profile = makeProfile('prof-cccccccccccc', {theme: 'dark', accidentals: 'flats'});
    useProfilesStore.setState({profiles: [profile], activeProfileId: profile.id});

    await service.exportProfile(profile.id);
    expect(savedJson).not.toBeNull();
    const parsed = JSON.parse(savedJson as string) as ProfileExportFile;
    expect(parsed.profile.theme).toBe('dark');
    expect(parsed.profile.accidentals).toBe('flats');
  });

  it('importing a file restores theme and accidentals', async () => {
    const service = newService();
    const file: ProfileExportFile = {
      schemaVersion: 1,
      exportedAt: '2026-01-02T00:00:00.000Z',
      profile: makeProfile('1700000000000-dddddddd', {theme: 'dark', accidentals: 'flats'}),
    };
    openJson = JSON.stringify(file);

    const result = await service.importProfile();
    expect(result.kind).toBe('imported');
    if (result.kind === 'imported') {
      expect(result.profile.theme).toBe('dark');
      expect(result.profile.accidentals).toBe('flats');
    }
  });

  it('applyExportFileDefaults fills missing theme/accidentals with system/sharps', () => {
    const file = {
      schemaVersion: 1,
      exportedAt: '2026-01-02T00:00:00.000Z',
      // theme + accidentals intentionally omitted.
      profile: {
        id: '1700000000001-eeeeeeee',
        name: 'No Prefs',
      },
    } as unknown as ProfileExportFile;

    const filled = applyExportFileDefaults(file);
    expect(filled.profile.theme).toBe('system');
    expect(filled.profile.accidentals).toBe('sharps');
  });
});
