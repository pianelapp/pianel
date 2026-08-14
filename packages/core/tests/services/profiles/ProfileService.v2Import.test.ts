import {inMemoryStorage} from '../../../src/store/storage';
import {createProfilesStore} from '../../../src/store/profilesStore';
import {ProfileService} from '../../../src/services/profiles/ProfileService';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import type {PianoService} from '../../../src/services/PianoService';
import type {PresetService} from '../../../src/services/presets/PresetService';
import type {FilePickerAdapter} from '../../../src/services/profiles/FilePickerAdapter';
import {OLDEST_SCHEMA_VERSION} from '../../../src/helpers/schemaHistory';
import {CURRENT_SCHEMA_VERSION} from '../../../src/types/schemaVersion';

function v1ExportFile() {
  return {
    schemaVersion: OLDEST_SCHEMA_VERSION,
    exportedAt: '2026-01-01T00:00:00.000Z',
    profile: {
      id: '1-aaaaaaaa',
      name: 'Legacy Gig',
      schemaVersion: OLDEST_SCHEMA_VERSION,
      theme: 'dark',
      accidentals: 'sharps',
      favorites: [],
      presets: [],
      defaultState: {...DEFAULT_PERFORMANCE_SNAPSHOT},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  };
}

function makeService(fileContents: string): ProfileService {
  const filePicker: FilePickerAdapter = {
    openProfileJson: async () => fileContents,
    saveProfileJson: async () => true,
  };

  const presetService = {
    captureSnapshot: () => ({...DEFAULT_PERFORMANCE_SNAPSHOT}),
    applySnapshot: async () => undefined,
    applyPreset: async () => undefined,
  } as unknown as PresetService;

  return new ProfileService(
    {} as unknown as PianoService,
    filePicker,
    presetService,
  );
}

describe('ProfileService v2 import', () => {
  beforeEach(async () => {
    await inMemoryStorage.removeItem('pianel:profiles');
    createProfilesStore({storage: inMemoryStorage});
  });

  it('imports a v1 export file, filling songs and setlists', async () => {
    const service = makeService(JSON.stringify(v1ExportFile()));
    const result = await service.importProfile();

    expect(result.kind).toBe('imported');
    if (result.kind !== 'imported') return;
    expect(result.profile.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.profile.songs).toEqual([]);
    expect(result.profile.setlists).toEqual([]);
    expect(result.profile.name).toBe('Legacy Gig');
  });

  it('imports a v2 export file with its songs intact', async () => {
    const v2 = v1ExportFile() as unknown as Record<string, unknown>;
    v2.schemaVersion = 2;
    const profile = v2.profile as Record<string, unknown>;
    profile.schemaVersion = 2;
    profile.id = '2-cccccccc';
    profile.songs = [
      {
        id: '2-bbbbbbbb',
        name: 'Superstition',
        scenes: [],
        createdAt: 'x',
        updatedAt: 'x',
      },
    ];
    profile.setlists = [];

    const service = makeService(JSON.stringify(v2));
    const result = await service.importProfile();

    expect(result.kind).toBe('imported');
    if (result.kind !== 'imported') return;
    expect(result.profile.songs).toHaveLength(1);
    expect(result.profile.songs[0].name).toBe('Superstition');
    expect(result.profile.setlists).toEqual([]);
  });
});
