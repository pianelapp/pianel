/**
 * Task 12 — Export/import at schemaVersion 2.
 *
 * Covers the two end-to-end import shapes not exercised elsewhere:
 *  - a v1 export file (no songs/setlists) imports cleanly, gaining empty
 *    arrays and schemaVersion 2 (the v1->v2 migrator, R8).
 *  - a v2 export file with populated `songs` imports with that data intact
 *    (migration must be a no-op passthrough for an already-current file).
 *
 * `ProfileService.schemaVersion.test.ts` already covers the malformed/
 * rejection edges of the same migration path (T081); this file is scoped to
 * the "does songs/setlists data survive the round trip" behaviour instead.
 */

import {inMemoryStorage} from '../../../src/store/storage';
import {createProfilesStore} from '../../../src/store/profilesStore';
import {ProfileService} from '../../../src/services/profiles/ProfileService';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import type {PianoService} from '../../../src/services/PianoService';
import type {PresetService} from '../../../src/services/presets/PresetService';
import type {FilePickerAdapter} from '../../../src/services/profiles/FilePickerAdapter';

function v1ExportFile() {
  return {
    schemaVersion: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    profile: {
      id: '1-aaaaaaaa',
      name: 'Legacy Gig',
      schemaVersion: 1,
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
  // The real `FilePickerAdapter` interface uses `openProfileJson` /
  // `saveProfileJson` (see src/services/profiles/FilePickerAdapter.ts).
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
    expect(result.profile.schemaVersion).toBe(2);
    expect(result.profile.songs).toEqual([]);
    expect(result.profile.setlists).toEqual([]);
    expect(result.profile.name).toBe('Legacy Gig');
  });

  it('imports a v2 export file with its songs intact', async () => {
    const v2 = v1ExportFile() as unknown as Record<string, unknown>;
    v2.schemaVersion = 2;
    const profile = v2.profile as Record<string, unknown>;
    profile.schemaVersion = 2;
    profile.id = '2-cccccccc'; // distinct id from the v1 fixture above
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
    // Guards against a migrator that discards songs on an already-current
    // file: setlists must survive untouched too, as an empty array (not
    // silently repopulated or dropped to undefined).
    expect(result.profile.setlists).toEqual([]);
  });
});
