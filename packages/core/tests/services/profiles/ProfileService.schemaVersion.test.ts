/**
 * T081 — Schema-version handling tests (US4).
 *
 * Covers:
 *  - schemaVersion 2 accepted (the current supported version this release).
 *  - schemaVersion > MAX_SUPPORTED rejected with UnsupportedProfileVersionError.
 *  - Missing schemaVersion treated as 1 (R2), which migrates forward to a v2
 *    profile via the registered v1→v2 migrator.
 *  - Migrator table carries the v1→v2 entry backed by `normalizeProfile()` (R8).
 *  - A migrated (v1/missing-version) file with an empty profile, a malformed
 *    id, or an empty name still rejects — migrating must not bypass the same
 *    shape validation a current-version file goes through.
 */

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
  MAX_SUPPORTED_SCHEMA_VERSION,
  MalformedProfileFileError,
  UnsupportedProfileVersionError,
} from '../../../src/types/profile';
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
    schemaVersion: 2,
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
  it('accepts schemaVersion: 2 (the current release)', async () => {
    const file = {
      schemaVersion: 2,
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

  // Regression: the v1→v2 migrator fills in songs/setlists but does not
  // vouch for fields it inherits unchanged. Before the migrated candidate
  // was routed through the same id/name/presets validation as a
  // current-version file, a malformed or empty v1 profile would migrate
  // cleanly and get persisted with an undefined id/name instead of
  // rejecting like it always did pre-migrator.
  it('rejects (rather than silently persisting) a missing-schemaVersion file whose profile is empty', async () => {
    const file = {
      exportedAt: '2026-01-01T00:00:00Z',
      profile: {},
    };
    const service = buildService(JSON.stringify(file));
    await expect(service.importProfile()).rejects.toThrow('invalid profile id');
    // The rejection must not have left a corrupt profile in the store.
    expect(useProfilesStore.getState().profiles).toHaveLength(0);
  });

  it('rejects a schemaVersion: 1 file whose profile id is malformed, and says so', async () => {
    const file = {
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      profile: {...validProfile(), id: 'not-a-valid-id'},
    };
    const service = buildService(JSON.stringify(file));
    // The error must still name the real problem (the id), not the version —
    // migrating a file must not launder a bad id into a passing shape check.
    await expect(service.importProfile()).rejects.toThrow('invalid profile id');
    expect(useProfilesStore.getState().profiles).toHaveLength(0);
  });

  it('rejects a schemaVersion: 1 file whose profile name is empty', async () => {
    const file = {
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      profile: {...validProfile(), name: ''},
    };
    const service = buildService(JSON.stringify(file));
    await expect(service.importProfile()).rejects.toThrow(
      'profile name must be non-empty',
    );
    expect(useProfilesStore.getState().profiles).toHaveLength(0);
  });

  it('rejects schemaVersion > MAX_SUPPORTED', async () => {
    const file = {
      schemaVersion: MAX_SUPPORTED_SCHEMA_VERSION + 1,
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

  it('MAX_SUPPORTED_SCHEMA_VERSION is 2 (this release; R8)', () => {
    expect(MAX_SUPPORTED_SCHEMA_VERSION).toBe(2);
  });
});
