import {inMemoryStorage} from '../../../src/store/storage';
import {createProfilesStore} from '../../../src/store/profilesStore';
import {SongService} from '../../../src/services/songs/SongService';
import {SetlistService} from '../../../src/services/setlists/SetlistService';
import {SetlistCursorService} from '../../../src/services/cursor/SetlistCursorService';
import {useCursorStore} from '../../../src/store/cursorStore';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import {CURRENT_SCHEMA_VERSION} from '../../../src/types/schemaVersion';
import type {Profile} from '../../../src/types/profile';
import type {PerformanceSnapshot} from '../../../src/types/performanceSnapshot';
import type {PresetService} from '../../../src/services/presets/PresetService';

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

function stubPresetService(): PresetService {
  let tempo = 100;
  return {
    captureSnapshot: () => ({...DEFAULT_PERFORMANCE_SNAPSHOT, tempo: tempo++}),
    applySnapshot: async (_: PerformanceSnapshot) => {},
  } as unknown as PresetService;
}

describe('cursor songId stays resolvable in the library', () => {
  let songs: SongService;
  let setlists: SetlistService;
  let cursor: SetlistCursorService;
  let listId: string;
  let firstId: string;
  let secondId: string;

  beforeEach(async () => {
    await inMemoryStorage.removeItem('pianel:profiles');
    const store = createProfilesStore({storage: inMemoryStorage});
    const profile = makeProfile();
    store.getState().addProfile(profile);
    store.getState().setActiveProfileId(profile.id);

    const preset = stubPresetService();
    songs = new SongService(preset);
    setlists = new SetlistService(songs);
    cursor = new SetlistCursorService(songs, setlists, preset);

    firstId = songs.createSong('Opener').id;
    songs.captureScene(firstId, 'Intro');
    songs.captureScene(firstId, 'Verse');

    secondId = songs.createSong('Closer').id;
    songs.captureScene(secondId, 'Head');

    listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, firstId);
    setlists.addSong(listId, secondId);
    useCursorStore.getState().exit();
  });

  it('enterPerform on a customized first entry stores a library id', async () => {
    const clone = setlists.customizeEntry(listId, 0);
    await cursor.enterPerform({setlistId: listId});

    const {songId} = useCursorStore.getState();
    expect(songId).toBe(firstId);
    expect(songs.getSong(songId)).not.toBeNull();
    expect(songId).not.toBe(clone.id);
  });

  it('jumpToSong onto a customized entry stores a library id', async () => {
    setlists.customizeEntry(listId, 1);
    await cursor.enterPerform({setlistId: listId});
    await cursor.jumpToSong(1);

    const {songId, entryIndex} = useCursorStore.getState();
    expect(entryIndex).toBe(1);
    expect(songId).toBe(secondId);
    expect(songs.getSong(songId)).not.toBeNull();
  });

  it('nextSong onto a customized entry stores a library id', async () => {
    setlists.customizeEntry(listId, 1);
    await cursor.enterPerform({setlistId: listId});
    await cursor.nextSong();

    const {songId} = useCursorStore.getState();
    expect(songId).toBe(secondId);
    expect(songs.getSong(songId)).not.toBeNull();
  });

  it('still resolves for uncustomized entries', async () => {
    await cursor.enterPerform({setlistId: listId});
    expect(songs.getSong(useCursorStore.getState().songId)).not.toBeNull();

    await cursor.jumpToSong(1);
    expect(songs.getSong(useCursorStore.getState().songId)).not.toBeNull();
  });

  it('still performs the override content, not the library version', async () => {
    const clone = setlists.customizeEntry(listId, 0);
    setlists.editOverride(listId, 0, song => ({
      ...song,
      scenes: song.scenes.slice(0, 1),
    }));
    await cursor.enterPerform({setlistId: listId});

    expect(useCursorStore.getState().songId).toBe(firstId);
    expect(cursor.getCurrentSong()?.id).toBe(clone.id);
    expect(cursor.getCurrentSong()?.scenes).toHaveLength(1);
    expect(songs.getSong(firstId)?.scenes).toHaveLength(2);
  });
});
