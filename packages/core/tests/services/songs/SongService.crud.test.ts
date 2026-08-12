import {inMemoryStorage} from '../../../src/store/storage';
import {createProfilesStore, useProfilesStore} from '../../../src/store/profilesStore';
import {SongService} from '../../../src/services/songs/SongService';
import {SongNotFoundError} from '../../../src/types/setlist';
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

/** Minimal PresetService stand-in — only captureSnapshot is exercised here. */
function fakePresetService(): PresetService {
  return {
    captureSnapshot: () => ({...DEFAULT_PERFORMANCE_SNAPSHOT}),
  } as unknown as PresetService;
}

describe('SongService CRUD', () => {
  let service: SongService;

  beforeEach(async () => {
    await inMemoryStorage.removeItem('pianel:profiles');
    const store = createProfilesStore({storage: inMemoryStorage});
    const profile = makeProfile();
    store.getState().addProfile(profile);
    store.getState().setActiveProfileId(profile.id);
    service = new SongService(fakePresetService());
  });

  it('createSong appends a song with an empty scene list', () => {
    const song = service.createSong('Isn\'t She Lovely');
    expect(song.name).toBe("Isn't She Lovely");
    expect(song.scenes).toEqual([]);
    expect(song.id).toMatch(/^\d+-[a-z0-9]{8,}$/);
    expect(service.listSongs()).toHaveLength(1);
  });

  it('createSong trims the name and rejects an empty one', () => {
    expect(service.createSong('  Superstition  ').name).toBe('Superstition');
    expect(() => service.createSong('   ')).toThrow('Song name cannot be empty.');
  });

  it('createSong allows duplicate names', () => {
    service.createSong('Untitled');
    service.createSong('Untitled');
    expect(service.listSongs()).toHaveLength(2);
  });

  it('getSong returns the song, or null when unknown', () => {
    const song = service.createSong('Overjoyed');
    expect(service.getSong(song.id)?.name).toBe('Overjoyed');
    expect(service.getSong('nope')).toBeNull();
  });

  it('renameSong changes the name and bumps updatedAt', () => {
    const song = service.createSong('Old');
    const renamed = service.renameSong(song.id, 'New');
    expect(renamed.name).toBe('New');
    expect(renamed.updatedAt >= song.updatedAt).toBe(true);
    expect(service.getSong(song.id)?.name).toBe('New');
  });

  it('renameSong throws SongNotFoundError for an unknown id', () => {
    expect(() => service.renameSong('nope', 'X')).toThrow(SongNotFoundError);
  });

  it('setSongNotes stores free text', () => {
    const song = service.createSong('Sir Duke');
    service.setSongNotes(song.id, 'count in 4');
    expect(service.getSong(song.id)?.notes).toBe('count in 4');
  });

  it('deleteSong removes it from the library', () => {
    const song = service.createSong('Doomed');
    service.deleteSong(song.id);
    expect(service.listSongs()).toEqual([]);
  });

  it('deleteSong throws SongNotFoundError for an unknown id', () => {
    expect(() => service.deleteSong('nope')).toThrow(SongNotFoundError);
  });

  it('persists songs onto the active profile', () => {
    service.createSong('Persisted');
    const active = useProfilesStore
      .getState()
      .profiles.find(p => p.id === '1-aaaaaaaa');
    expect(active?.songs).toHaveLength(1);
  });
});
