import {inMemoryStorage} from '../../../src/store/storage';
import {createProfilesStore} from '../../../src/store/profilesStore';
import {SongService} from '../../../src/services/songs/SongService';
import {SetlistService} from '../../../src/services/setlists/SetlistService';
import {patchScene} from '../../../src/helpers/songEdits';
import {
  EntryNotFoundError,
  MissingSongError,
  SetlistNotFoundError,
} from '../../../src/types/setlist';
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
    // A shallow spread would share `metronome`/`voiceModeSnapshot`/
    // `quickToneSlots` by reference with the module-level
    // `DEFAULT_PERFORMANCE_SNAPSHOT` singleton — the deep-mutation tests below
    // write through those nested objects, so a shallow copy here would leak
    // mutations into every other test file that imports the same constant.
    captureSnapshot: () => ({
      ...DEFAULT_PERFORMANCE_SNAPSHOT,
      metronome: {...DEFAULT_PERFORMANCE_SNAPSHOT.metronome},
      voiceModeSnapshot: {...DEFAULT_PERFORMANCE_SNAPSHOT.voiceModeSnapshot},
      quickToneSlots: [...DEFAULT_PERFORMANCE_SNAPSHOT.quickToneSlots],
    }),
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
    // catch that. Assertions on `clone.name`, `clone.scenes.length`, and
    // `clone.id` alone would still pass on a shallow copy too.
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

  it('countSetlistsUsing counts a setlist once even if the song appears in it twice', () => {
    // `listId` already has one uncustomized entry for `songId` from
    // `beforeEach`; add a second one in the same setlist.
    setlists.addSong(listId, songId);
    expect(setlists.countSetlistsUsing(songId)).toBe(1);
  });

  it('customizeEntry throws EntryNotFoundError for an out-of-range index', () => {
    expect(() => setlists.customizeEntry(listId, 9)).toThrow(EntryNotFoundError);
    expect(() => setlists.customizeEntry(listId, 9)).toThrow('No entry at index 9');
  });

  it('customizeEntry throws MissingSongError when the entry references a deleted song', () => {
    songs.deleteSong(songId);
    expect(() => setlists.customizeEntry(listId, 0)).toThrow(MissingSongError);
  });

  it('promoteEntry throws MissingSongError when the library song was deleted after customization', () => {
    setlists.customizeEntry(listId, 0);
    songs.deleteSong(songId);
    expect(() => setlists.promoteEntry(listId, 0)).toThrow(MissingSongError);
  });

  it('removeEntry is a no-op for an out-of-range index: no write, updatedAt unchanged', () => {
    const before = setlists.getSetlist(listId)!;
    const beforeUpdatedAt = before.updatedAt;

    const result = setlists.removeEntry(listId, 9);

    expect(result).toEqual(before);
    expect(setlists.getSetlist(listId)?.updatedAt).toBe(beforeUpdatedAt);
    expect(setlists.getSetlist(listId)?.entries).toHaveLength(1);
  });

  describe('editOverride', () => {
    it('changes what resolveEntry returns', () => {
      setlists.customizeEntry(listId, 0);
      setlists.editOverride(listId, 0, song => ({...song, name: 'Gig Name'}));
      expect(setlists.resolveEntry(listId, 0)?.name).toBe('Gig Name');
    });

    it('leaves the library song unaffected — the point of the whole feature', () => {
      setlists.customizeEntry(listId, 0);
      setlists.editOverride(listId, 0, song => ({...song, name: 'Gig Name'}));
      expect(songs.getSong(songId)?.name).toBe("Isn't She Lovely");
    });

    it('composes a scene-level edit, changing only the override scene', () => {
      const clone = setlists.customizeEntry(listId, 0);
      const sceneId = clone.scenes[0].id;

      setlists.editOverride(listId, 0, song =>
        patchScene(song, sceneId, s => ({...s, label: 'Gig Chorus'})),
      );

      expect(setlists.resolveEntry(listId, 0)?.scenes[0].label).toBe('Gig Chorus');
      // The library song's scene keeps its original label.
      expect(songs.getSong(songId)?.scenes[0].label).toBe('Intro');
    });

    it('stamps the override updatedAt', () => {
      setlists.customizeEntry(listId, 0);
      // A `>=` comparison against the pre-edit `updatedAt` can't fail: if the
      // stamp were dropped entirely, `next.updatedAt` would just echo the
      // stored value back, which is still `>=` itself. Write a sentinel the
      // stamp must overwrite instead — this only passes if `editOverride`
      // actually replaces `updatedAt` with a fresh timestamp.
      const next = setlists.editOverride(listId, 0, s => ({
        ...s,
        updatedAt: '2000-01-01T00:00:00.000Z',
      }));
      expect(next.updatedAt).not.toBe('2000-01-01T00:00:00.000Z');
    });

    it('throws "is not customized" for an entry with no override', () => {
      expect(() => setlists.editOverride(listId, 0, song => song)).toThrow(
        'is not customized',
      );
    });

    it('throws SetlistNotFoundError for an unknown setlist', () => {
      expect(() => setlists.editOverride('nope', 0, song => song)).toThrow(
        SetlistNotFoundError,
      );
    });

    it('throws EntryNotFoundError for a bad index', () => {
      setlists.customizeEntry(listId, 0);
      expect(() => setlists.editOverride(listId, 9, song => song)).toThrow(
        EntryNotFoundError,
      );
      expect(() => setlists.editOverride(listId, 9, song => song)).toThrow(
        'No entry at index 9',
      );
    });
  });
});
