import {inMemoryStorage} from '../../../src/store/storage';
import {createProfilesStore} from '../../../src/store/profilesStore';
import {SongService} from '../../../src/services/songs/SongService';
import {SetlistService} from '../../../src/services/setlists/SetlistService';
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
    captureSnapshot: () => ({
      ...DEFAULT_PERFORMANCE_SNAPSHOT,
      metronome: {...DEFAULT_PERFORMANCE_SNAPSHOT.metronome},
      voiceModeSnapshot: {...DEFAULT_PERFORMANCE_SNAPSHOT.voiceModeSnapshot},
      quickToneSlots: [...DEFAULT_PERFORMANCE_SNAPSHOT.quickToneSlots],
    }),
  } as unknown as PresetService;
}

describe('findLibraryUses', () => {
  let songs: SongService;
  let setlists: SetlistService;

  beforeEach(async () => {
    await inMemoryStorage.removeItem('pianel:profiles');
    const store = createProfilesStore({storage: inMemoryStorage});
    const profile = makeProfile();
    store.getState().addProfile(profile);
    store.getState().setActiveProfileId(profile.id);
    songs = new SongService(fakePresetService());
    setlists = new SetlistService(songs);
  });

  it('returns nothing for a song no setlist references', () => {
    const songId = songs.createSong('Unused').id;
    expect(setlists.findLibraryUses(songId)).toEqual([]);
  });

  it('returns every undetached entry, with its index', () => {
    const a = songs.createSong('Shared').id;
    songs.captureScene(a, 'x');
    const filler = songs.createSong('Filler').id;
    songs.captureScene(filler, 'y');

    const one = setlists.createSetlist('Gig One').id;
    const two = setlists.createSetlist('Gig Two').id;
    setlists.addSong(one, filler);
    setlists.addSong(one, a);
    setlists.addSong(two, a);

    expect(setlists.findLibraryUses(a)).toEqual([
      {setlistId: one, entryIndex: 1},
      {setlistId: two, entryIndex: 0},
    ]);
  });

  it('skips entries already detached', () => {
    const a = songs.createSong('Shared').id;
    songs.captureScene(a, 'x');
    const one = setlists.createSetlist('Gig One').id;
    const two = setlists.createSetlist('Gig Two').id;
    setlists.addSong(one, a);
    setlists.addSong(two, a);
    setlists.customizeEntry(one, 0);

    expect(setlists.findLibraryUses(a)).toEqual([{setlistId: two, entryIndex: 0}]);
  });

  it('counts entries where countSetlistsUsing counts setlists', () => {
    const a = songs.createSong('Twice').id;
    songs.captureScene(a, 'x');
    const one = setlists.createSetlist('Gig').id;
    setlists.addSong(one, a);
    setlists.addSong(one, a);

    expect(setlists.findLibraryUses(a)).toHaveLength(2);
    expect(setlists.countSetlistsUsing(a)).toBe(1);
  });
});
