import {inMemoryStorage} from '../../../src/store/storage';
import {createProfilesStore} from '../../../src/store/profilesStore';
import {SongService} from '../../../src/services/songs/SongService';
import {SetlistService} from '../../../src/services/setlists/SetlistService';
import {SetlistNotFoundError, SongNotFoundError} from '../../../src/types/setlist';
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

describe('SetlistService CRUD', () => {
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

  it('createSetlist appends an empty setlist', () => {
    const list = setlists.createSetlist('Bar Gig');
    expect(list.name).toBe('Bar Gig');
    expect(list.entries).toEqual([]);
    expect(setlists.listSetlists()).toHaveLength(1);
  });

  it('createSetlist trims and rejects an empty name', () => {
    expect(setlists.createSetlist('  Wedding  ').name).toBe('Wedding');
    expect(() => setlists.createSetlist(' ')).toThrow('Setlist name cannot be empty.');
  });

  it('renameSetlist and deleteSetlist work by id', () => {
    const list = setlists.createSetlist('Old');
    expect(setlists.renameSetlist(list.id, 'New').name).toBe('New');
    setlists.deleteSetlist(list.id);
    expect(setlists.listSetlists()).toEqual([]);
  });

  it('setlist mutators throw SetlistNotFoundError for an unknown id', () => {
    expect(() => setlists.renameSetlist('nope', 'X')).toThrow(SetlistNotFoundError);
    expect(() => setlists.deleteSetlist('nope')).toThrow(SetlistNotFoundError);
  });

  it('addSong appends an entry referencing the library song', () => {
    const song = songs.createSong('Superstition');
    const list = setlists.createSetlist('Gig');
    const updated = setlists.addSong(list.id, song.id);
    expect(updated.entries).toEqual([{songId: song.id, override: null}]);
  });

  it('addSong throws SongNotFoundError when the song is unknown', () => {
    const list = setlists.createSetlist('Gig');
    expect(() => setlists.addSong(list.id, 'nope')).toThrow(SongNotFoundError);
  });

  it('addSong allows the same song twice', () => {
    const song = songs.createSong('Encore');
    const list = setlists.createSetlist('Gig');
    setlists.addSong(list.id, song.id);
    const updated = setlists.addSong(list.id, song.id);
    expect(updated.entries).toHaveLength(2);
  });

  it('moveEntry reorders by array position and clamps', () => {
    const a = songs.createSong('A');
    const b = songs.createSong('B');
    const c = songs.createSong('C');
    const list = setlists.createSetlist('Gig');
    setlists.addSong(list.id, a.id);
    setlists.addSong(list.id, b.id);
    setlists.addSong(list.id, c.id);

    setlists.moveEntry(list.id, 2, 0);
    expect(setlists.getSetlist(list.id)?.entries.map(e => e.songId)).toEqual([
      c.id, a.id, b.id,
    ]);

    setlists.moveEntry(list.id, 0, 99);
    expect(setlists.getSetlist(list.id)?.entries.map(e => e.songId)).toEqual([
      a.id, b.id, c.id,
    ]);
  });

  it('removeEntry drops by index', () => {
    const a = songs.createSong('A');
    const b = songs.createSong('B');
    const list = setlists.createSetlist('Gig');
    setlists.addSong(list.id, a.id);
    setlists.addSong(list.id, b.id);
    setlists.removeEntry(list.id, 0);
    expect(setlists.getSetlist(list.id)?.entries.map(e => e.songId)).toEqual([b.id]);
  });

  it('resolveEntry returns the library song when there is no override', () => {
    const song = songs.createSong('Sir Duke');
    const list = setlists.createSetlist('Gig');
    setlists.addSong(list.id, song.id);
    expect(setlists.resolveEntry(list.id, 0)?.name).toBe('Sir Duke');
  });

  it('resolveEntry returns null for a deleted library song', () => {
    const song = songs.createSong('Doomed');
    const list = setlists.createSetlist('Gig');
    setlists.addSong(list.id, song.id);
    songs.deleteSong(song.id);
    expect(setlists.resolveEntry(list.id, 0)).toBeNull();
  });

  it('resolveEntry returns null for an out-of-range index', () => {
    const list = setlists.createSetlist('Gig');
    expect(setlists.resolveEntry(list.id, 5)).toBeNull();
  });
});
