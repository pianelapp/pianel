import {inMemoryStorage} from '../../../src/store/storage';
import {createProfilesStore} from '../../../src/store/profilesStore';
import {SongService} from '../../../src/services/songs/SongService';
import {SetlistService} from '../../../src/services/setlists/SetlistService';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import type {Profile} from '../../../src/types/profile';
import type {PresetService} from '../../../src/services/presets/PresetService';

function makeProfile(): Profile {
  const now = new Date().toISOString();
  return {
    id: '1-aaaaaaaa',
    name: 'Workspace',
    schemaVersion: 2,
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

describe('SetlistService overrides', () => {
  let songs: SongService;
  let setlists: SetlistService;
  let songId: string;
  let listId: string;

  beforeEach(async () => {
    await inMemoryStorage.removeItem('pianel:profiles');
    const store = createProfilesStore({storage: inMemoryStorage});
    const profile = makeProfile();
    store.getState().addProfile(profile);
    store.getState().setActiveProfileId(profile.id);
    songs = new SongService(fakePresetService());
    setlists = new SetlistService(songs);

    songId = songs.createSong('Isn\'t She Lovely').id;
    songs.captureScene(songId, 'Intro');
    listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
  });

  it('starts uncustomized', () => {
    expect(setlists.isCustomized(listId, 0)).toBe(false);
  });

  it('customizeEntry clones the library song into the entry', () => {
    const clone = setlists.customizeEntry(listId, 0);
    expect(setlists.isCustomized(listId, 0)).toBe(true);
    expect(clone.name).toBe("Isn't She Lovely");
    expect(clone.scenes).toHaveLength(1);
    // A distinct id keeps the clone independent of the library record.
    expect(clone.id).not.toBe(songId);
  });

  it('customizeEntry produces a true deep clone: nested mutations never cross', () => {
    // Give the library scene distinguishable nested content, including
    // inside `snapshot.voiceModeSnapshot` -- that is where the real nesting
    // lives. A regression to a shallow `{...source, id, updatedAt}` copy
    // would leave `scenes` (and everything inside each scene) pointing at
    // the exact same objects as the library song; only a nested mutation can
    // catch that. The brief's own assertions (`clone.name`,
    // `clone.scenes.length`, `clone.id`) all pass on a shallow copy too.
    const before = songs.getSong(songId)!;
    before.scenes[0].snapshot.voiceModeSnapshot.rightToneId = 'lib-original';

    const clone = setlists.customizeEntry(listId, 0);

    // Direction 1: mutate the library song's stored scene object directly.
    // A shallow clone would leak this straight into `clone`.
    const librarySong = songs.getSong(songId)!;
    librarySong.scenes[0].label = 'Mutated In Library';
    librarySong.scenes[0].snapshot.voiceModeSnapshot.rightToneId = 'mutated-in-library';
    expect(clone.scenes[0].label).toBe('Intro');
    expect(clone.scenes[0].snapshot.voiceModeSnapshot.rightToneId).toBe('lib-original');

    // Direction 2 -- the one most likely to be missed: `customizeEntry` hands
    // back a live reference into store state, so mutating the clone directly
    // is possible. That must not reach the library song either.
    clone.scenes[0].label = 'Mutated In Clone';
    clone.scenes[0].snapshot.voiceModeSnapshot.rightToneId = 'mutated-in-clone';
    const libraryAfter = songs.getSong(songId)!;
    expect(libraryAfter.scenes[0].label).toBe('Mutated In Library');
    expect(libraryAfter.scenes[0].snapshot.voiceModeSnapshot.rightToneId).toBe(
      'mutated-in-library',
    );
  });

  it('editing the library song does not affect a customized entry', () => {
    setlists.customizeEntry(listId, 0);
    songs.renameSong(songId, 'Renamed In Library');
    expect(setlists.resolveEntry(listId, 0)?.name).toBe("Isn't She Lovely");
  });

  it('editing the library song does affect an uncustomized entry', () => {
    songs.renameSong(songId, 'Renamed In Library');
    expect(setlists.resolveEntry(listId, 0)?.name).toBe('Renamed In Library');
  });

  it('customizeEntry on an already-customized entry is a no-op', () => {
    const first = setlists.customizeEntry(listId, 0);
    const second = setlists.customizeEntry(listId, 0);
    expect(second.id).toBe(first.id);
  });

  it('revertEntry discards the override', () => {
    setlists.customizeEntry(listId, 0);
    setlists.revertEntry(listId, 0);
    expect(setlists.isCustomized(listId, 0)).toBe(false);
    expect(setlists.resolveEntry(listId, 0)?.id).toBe(songId);
  });

  it('promoteEntry copies the override back into the library and clears it', () => {
    const clone = setlists.customizeEntry(listId, 0);
    // The override is a full copy embedded in the entry, not a row in the
    // song library (SetlistEntry.override: Song | null) — SongService has no
    // way to address it by id, so the gig-specific edit is modeled directly
    // on the clone rather than through `songs.renameSong(clone.id, ...)`,
    // which would throw SongNotFoundError.
    clone.name = 'Gig Version';
    const promoted = setlists.promoteEntry(listId, 0);

    expect(promoted.id).toBe(songId);
    expect(songs.getSong(songId)?.name).toBe('Gig Version');
    expect(setlists.isCustomized(listId, 0)).toBe(false);
  });

  it('countSetlistsUsing counts uncustomized references only', () => {
    const second = setlists.createSetlist('Wedding').id;
    setlists.addSong(second, songId);
    expect(setlists.countSetlistsUsing(songId)).toBe(2);

    setlists.customizeEntry(second, 0);
    expect(setlists.countSetlistsUsing(songId)).toBe(1);
  });

  it('customizeEntry throws for an out-of-range index', () => {
    expect(() => setlists.customizeEntry(listId, 9)).toThrow('No entry at index 9');
  });
});
