import {ProfileService} from '../../../src/services/profiles/ProfileService';
import {PresetService} from '../../../src/services/presets/PresetService';
import {PianoService} from '../../../src/services/PianoService';
import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {createProfilesStore, useProfilesStore} from '../../../src/store/profilesStore';
import {createPerformanceStore} from '../../../src/store/performanceStore';
import {createAppSettingsStore} from '../../../src/store/appSettingsStore';
import {createFavoritesStore} from '../../../src/store/favoritesStore';
import {createConnectionStore} from '../../../src/store/connectionStore';
import {inMemoryStorage} from '../../../src/store/storage';
import {
  MalformedProfileFileError,
  UnsupportedProfileVersionError,
} from '../../../src/types/profile';
import type {Transport} from '../../../src/transport/types';
import type {FilePickerAdapter} from '../../../src/services/profiles/FilePickerAdapter';
import {CURRENT_SCHEMA_VERSION} from '../../../src/types/schemaVersion';
import {OLDEST_SCHEMA_VERSION} from '../../../src/helpers/schemaHistory';

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

function buildService(content: string | null): ProfileService {
  const transport = new FakeTransport();
  const pianoService = new PianoService(transport);
  pianoService.setEngine(new FP30XEngine());
  const presetService = new PresetService(pianoService);
  const picker: FilePickerAdapter = {
    async openProfileJson() {
      return content;
    },
    async saveProfileJson() {
      return true;
    },
  };
  return new ProfileService(pianoService, picker, presetService);
}

function validProfile() {
  const now = new Date().toISOString();
  return {
    id: '1234567890-abcdefgh',
    name: 'Test',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: 'system',
    accidentals: 'sharps',
    favorites: [],
    presets: [],
    songs: [],
    setlists: [],
    defaultState: {
      volume: 100,
      tempo: 120,
      metronome: {},
      voiceModeSnapshot: {
        voiceMode: 'single',
        rightToneId: null,
        leftToneId: null,
        dualTone2Id: null,
      },
      currentToneId: null,
      quickToneSlots: [null, null, null],
    },
    createdAt: now,
    updatedAt: now,
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
});

describe('schemaVersion validation', () => {
  it('accepts a file at the current schema version', async () => {
    const file = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: '2026-01-01T00:00:00Z',
      profile: validProfile(),
    };
    const service = buildService(JSON.stringify(file));
    const result = await service.importProfile();
    expect(result.kind).toBe('imported');
  });

  it('treats missing schemaVersion as 1 (R2 forward-compat for hand-edited files)', async () => {
    const file = {
      exportedAt: '2026-01-01T00:00:00Z',
      profile: validProfile(),
    };
    const service = buildService(JSON.stringify(file));
    const result = await service.importProfile();
    expect(result.kind).toBe('imported');
  });

  it('rejects (rather than silently persisting) a missing-schemaVersion file whose profile is empty', async () => {
    const file = {
      exportedAt: '2026-01-01T00:00:00Z',
      profile: {},
    };
    const service = buildService(JSON.stringify(file));
    await expect(service.importProfile()).rejects.toThrow('invalid profile id');
    expect(useProfilesStore.getState().profiles).toHaveLength(0);
  });

  it('rejects an oldest-version file whose profile id is malformed, and says so', async () => {
    const file = {
      schemaVersion: OLDEST_SCHEMA_VERSION,
      exportedAt: '2026-01-01T00:00:00Z',
      profile: {...validProfile(), id: 'not-a-valid-id'},
    };
    const service = buildService(JSON.stringify(file));
    await expect(service.importProfile()).rejects.toThrow('invalid profile id');
    expect(useProfilesStore.getState().profiles).toHaveLength(0);
  });

  it('rejects an oldest-version file whose profile name is empty', async () => {
    const file = {
      schemaVersion: OLDEST_SCHEMA_VERSION,
      exportedAt: '2026-01-01T00:00:00Z',
      profile: {...validProfile(), name: ''},
    };
    const service = buildService(JSON.stringify(file));
    await expect(service.importProfile()).rejects.toThrow(
      'profile name must be non-empty',
    );
    expect(useProfilesStore.getState().profiles).toHaveLength(0);
  });

  it('rejects schemaVersion > CURRENT_SCHEMA_VERSION', async () => {
    const file = {
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      exportedAt: '2026-01-01T00:00:00Z',
      profile: validProfile(),
    };
    const service = buildService(JSON.stringify(file));
    await expect(service.importProfile()).rejects.toBeInstanceOf(
      UnsupportedProfileVersionError,
    );
  });

  it('rejects negative schemaVersion as malformed', async () => {
    const file = {
      schemaVersion: -1,
      exportedAt: '2026-01-01T00:00:00Z',
      profile: validProfile(),
    };
    const service = buildService(JSON.stringify(file));
    await expect(service.importProfile()).rejects.toBeInstanceOf(
      MalformedProfileFileError,
    );
  });
});
