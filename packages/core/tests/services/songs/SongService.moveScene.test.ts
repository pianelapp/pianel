import {inMemoryStorage} from '../../../src/store/storage';
import {createProfilesStore} from '../../../src/store/profilesStore';
import {SongService} from '../../../src/services/songs/SongService';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import type {Profile} from '../../../src/types/profile';
import type {PresetService} from '../../../src/services/presets/PresetService';
import {CURRENT_SCHEMA_VERSION} from '../../../src/types/schemaVersion';

function makeProfile(): Profile {
  const now = new Date().toISOString();
  return {
    id: '1-aaaaaaaa',
    name: 'Workspace',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: 'system',
    accidentals: 'sharps',
    favorites: [],
    presets: [],
    songs: [],
    setlists: [],
    defaultState: {...DEFAULT_PERFORMANCE_SNAPSHOT},
    createdAt: now,
    updatedAt: now,
  };
}

function fakePresetService(): PresetService {
  return {
    captureSnapshot: () => ({...DEFAULT_PERFORMANCE_SNAPSHOT}),
  } as unknown as PresetService;
}

describe('SongService.moveScene no-op write behaviour', () => {
  let service: SongService;
  let songId: string;

  beforeEach(async () => {
    await inMemoryStorage.removeItem('pianel:profiles');
    const store = createProfilesStore({storage: inMemoryStorage});
    const profile = makeProfile();
    store.getState().addProfile(profile);
    store.getState().setActiveProfileId(profile.id);
    service = new SongService(fakePresetService());
    songId = service.createSong('Isn\'t She Lovely').id;
  });

  it('does not bump updatedAt when from and to clamp to the same index', () => {
    service.captureScene(songId, 'A');
    service.captureScene(songId, 'B');
    service.captureScene(songId, 'C');

    const before = service.getSong(songId)!.updatedAt;
    const result = service.moveScene(songId, 1, 1);

    expect(result.updatedAt).toBe(before);
    expect(service.getSong(songId)!.updatedAt).toBe(before);
  });
});
