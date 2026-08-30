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

const PRE_KEY_TOUCH_VERSION = 2;

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

  it('imports a v2 profile written before key touch existed', async () => {
    const file = {
      schemaVersion: PRE_KEY_TOUCH_VERSION,
      exportedAt: '2026-01-01T00:00:00Z',
      profile: {...validProfile(), schemaVersion: PRE_KEY_TOUCH_VERSION},
    };
    const service = buildService(JSON.stringify(file));
    const result = await service.importProfile();

    expect(result.kind).toBe('imported');
    const stored = useProfilesStore.getState().profiles[0];
    expect(stored.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('leaves key touch absent on a v2 import rather than inventing a curve', async () => {
    const file = {
      schemaVersion: PRE_KEY_TOUCH_VERSION,
      exportedAt: '2026-01-01T00:00:00Z',
      profile: {...validProfile(), schemaVersion: PRE_KEY_TOUCH_VERSION},
    };
    const service = buildService(JSON.stringify(file));
    await service.importProfile();

    const stored = useProfilesStore.getState().profiles[0];
    expect(stored.defaultState.keyTouch).toBeUndefined();
  });

  it('carries the rest of a v2 profile through the key-touch hop untouched', async () => {
    const original = {...validProfile(), schemaVersion: PRE_KEY_TOUCH_VERSION};
    const file = {
      schemaVersion: PRE_KEY_TOUCH_VERSION,
      exportedAt: '2026-01-01T00:00:00Z',
      profile: original,
    };
    const service = buildService(JSON.stringify(file));
    await service.importProfile();

    const stored = useProfilesStore.getState().profiles[0];
    expect(stored.id).toBe(original.id);
    expect(stored.name).toBe(original.name);
    expect(stored.defaultState.volume).toBe(original.defaultState.volume);
    expect(stored.defaultState.tempo).toBe(original.defaultState.tempo);
    expect(stored.defaultState.voiceModeSnapshot).toEqual(
      original.defaultState.voiceModeSnapshot,
    );
  });

  it('keeps a captured key touch curve through a current-version import', async () => {
    const profile = validProfile();
    const file = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: '2026-01-01T00:00:00Z',
      profile: {
        ...profile,
        defaultState: {...profile.defaultState, keyTouch: 5},
      },
    };
    const service = buildService(JSON.stringify(file));
    await service.importProfile();

    const stored = useProfilesStore.getState().profiles[0];
    expect(stored.defaultState.keyTouch).toBe(5);
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
