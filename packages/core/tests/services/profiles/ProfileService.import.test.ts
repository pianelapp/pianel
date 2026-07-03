/**
 * T065 — ProfileService import tests (US3).
 *
 * Covers:
 *  - malformed JSON → MalformedProfileFileError (FR-022).
 *  - schemaVersion > MAX_SUPPORTED → UnsupportedProfileVersionError.
 *  - ID collision → returns `{kind: 'conflict', parsed, existing}` (FR-020).
 *  - `confirmImportOverwrite(parsed)` replaces existing in place (no
 *    duplicate; SC-006).
 *  - No ID collision + no name collision → inserts new profile and returns
 *    `{kind: 'imported', profile}`.
 *  - No ID collision + name collision → auto-suffix `" (Imported)"`, then
 *    `" (Imported 2)"`, etc. (R6).
 *  - Cancelled dialog → `{kind: 'cancelled'}`.
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
  MalformedProfileFileError,
  UnsupportedProfileVersionError,
} from '../../../src/types/profile';
import type {ProfileExportFile} from '../../../src/types/profile';
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

function buildPicker(content: string | null) {
  const picker: FilePickerAdapter = {
    async openProfileJson() {
      return content;
    },
    async saveProfileJson() {
      return true;
    },
  };
  return picker;
}

function buildService(picker: FilePickerAdapter): ProfileService {
  const transport = new FakeTransport();
  const pianoService = new PianoService(transport);
  pianoService.setEngine(new FP30XEngine());
  const presetService = new PresetService(pianoService);
  return new ProfileService(pianoService, picker, presetService);
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

// ─── Helpers ────────────────────────────────────────────────────

function validExportFile(id: string, name: string): ProfileExportFile {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    exportedAt: now,
    profile: {
      id,
      name,
      schemaVersion: 1,
      theme: 'system',
      accidentals: 'sharps',
      favorites: [],
      presets: [],
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
    },
  };
}

// ─── Validation ─────────────────────────────────────────────────

describe('ProfileService.importProfile — validation', () => {
  it('returns cancelled when file picker resolves null', async () => {
    const service = buildService(buildPicker(null));
    const result = await service.importProfile();
    expect(result.kind).toBe('cancelled');
  });

  it('throws MalformedProfileFileError on invalid JSON', async () => {
    const service = buildService(buildPicker('not json'));
    await expect(service.importProfile()).rejects.toBeInstanceOf(
      MalformedProfileFileError,
    );
  });

  it('throws UnsupportedProfileVersionError when schemaVersion > MAX', async () => {
    const file = validExportFile('1234567890-abcdefgh', 'Alpha');
    (file as unknown as {schemaVersion: number}).schemaVersion = 2;
    const service = buildService(buildPicker(JSON.stringify(file)));
    await expect(service.importProfile()).rejects.toBeInstanceOf(
      UnsupportedProfileVersionError,
    );
  });

  it('rejects malformed profile id', async () => {
    const file = validExportFile('not-a-valid-id', 'Alpha');
    const service = buildService(buildPicker(JSON.stringify(file)));
    await expect(service.importProfile()).rejects.toBeInstanceOf(
      MalformedProfileFileError,
    );
  });

  it('rejects empty profile name', async () => {
    const file = validExportFile('1234567890-abcdefgh', '');
    const service = buildService(buildPicker(JSON.stringify(file)));
    await expect(service.importProfile()).rejects.toBeInstanceOf(
      MalformedProfileFileError,
    );
  });
});

// ─── Happy paths ────────────────────────────────────────────────

describe('ProfileService.importProfile — happy paths', () => {
  it('inserts a fresh profile when neither id nor name collide', async () => {
    const file = validExportFile('1234567890-abcdefgh', 'NewProfile');
    const service = buildService(buildPicker(JSON.stringify(file)));
    const result = await service.importProfile();
    expect(result.kind).toBe('imported');
    if (result.kind === 'imported') {
      expect(result.profile.name).toBe('NewProfile');
      expect(useProfilesStore.getState().profiles).toHaveLength(1);
    }
  });

  it('auto-suffixes " (Imported)" on name conflict (no id match)', async () => {
    const fakeSave: FilePickerAdapter = {
      async openProfileJson() {
        return null;
      },
      async saveProfileJson() {
        return true;
      },
    };
    const setup = buildService(fakeSave);
    await setup.createProfile('Alpha');

    const file = validExportFile('1234567890-abcdefgh', 'Alpha');
    const service = buildService(buildPicker(JSON.stringify(file)));
    const result = await service.importProfile();
    expect(result.kind).toBe('imported');
    if (result.kind === 'imported') {
      expect(result.profile.name).toBe('Alpha (Imported)');
    }
  });

  it('auto-suffixes " (Imported N)" for second-and-later collisions', async () => {
    const fakeSave: FilePickerAdapter = {
      async openProfileJson() {
        return null;
      },
      async saveProfileJson() {
        return true;
      },
    };
    const setup = buildService(fakeSave);
    await setup.createProfile('Alpha');
    await setup.createProfile('Alpha (Imported)');

    const file = validExportFile('1234567890-aaaaaaaa', 'Alpha');
    const service = buildService(buildPicker(JSON.stringify(file)));
    const result = await service.importProfile();
    expect(result.kind).toBe('imported');
    if (result.kind === 'imported') {
      expect(result.profile.name).toBe('Alpha (Imported 2)');
    }
  });
});

// ─── Conflict branch ────────────────────────────────────────────

describe('ProfileService.importProfile — id collision', () => {
  it('returns conflict when id matches an existing profile', async () => {
    const fakeSave: FilePickerAdapter = {
      async openProfileJson() {
        return null;
      },
      async saveProfileJson() {
        return true;
      },
    };
    const setup = buildService(fakeSave);
    const existing = await setup.createProfile('Alpha');

    const file = validExportFile(existing.id, 'AlphaOnAnotherDevice');
    const service = buildService(buildPicker(JSON.stringify(file)));
    const result = await service.importProfile();
    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      expect(result.existing.id).toBe(existing.id);
      expect(result.parsed.profile.name).toBe('AlphaOnAnotherDevice');
    }
  });

  it('confirmImportOverwrite replaces in place (no duplicate — SC-006)', async () => {
    const fakeSave: FilePickerAdapter = {
      async openProfileJson() {
        return null;
      },
      async saveProfileJson() {
        return true;
      },
    };
    const setup = buildService(fakeSave);
    const existing = await setup.createProfile('Alpha');

    const file = validExportFile(existing.id, 'Renamed Alpha');
    const service = buildService(buildPicker(JSON.stringify(file)));
    const result = await service.importProfile();
    if (result.kind !== 'conflict') throw new Error('expected conflict');

    await service.confirmImportOverwrite(result.parsed);
    const profiles = useProfilesStore.getState().profiles;
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe(existing.id);
    expect(profiles[0].name).toBe('Renamed Alpha');
  });
});
