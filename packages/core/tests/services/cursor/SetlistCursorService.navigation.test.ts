import {inMemoryStorage} from '../../../src/store/storage';
import {createProfilesStore} from '../../../src/store/profilesStore';
import {SongService} from '../../../src/services/songs/SongService';
import {SetlistService} from '../../../src/services/setlists/SetlistService';
import {SetlistCursorService} from '../../../src/services/cursor/SetlistCursorService';
import {useCursorStore} from '../../../src/store/cursorStore';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import type {Profile} from '../../../src/types/profile';
import type {PerformanceSnapshot} from '../../../src/types/performanceSnapshot';
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

function recordingPresetService() {
  const applied: PerformanceSnapshot[] = [];
  let tempo = 100;
  const service = {
    captureSnapshot: () => ({...DEFAULT_PERFORMANCE_SNAPSHOT, tempo: tempo++}),
    applySnapshot: async (snapshot: PerformanceSnapshot) => {
      applied.push(snapshot);
    },
  } as unknown as PresetService;
  return {service, applied};
}

describe('SetlistCursorService navigation', () => {
  let songs: SongService;
  let setlists: SetlistService;
  let cursor: SetlistCursorService;
  let applied: PerformanceSnapshot[];
  let songA: string;
  let songB: string;
  let listId: string;

  beforeEach(async () => {
    await inMemoryStorage.removeItem('pianel:profiles');
    const store = createProfilesStore({storage: inMemoryStorage});
    const profile = makeProfile();
    store.getState().addProfile(profile);
    store.getState().setActiveProfileId(profile.id);

    const rec = recordingPresetService();
    applied = rec.applied;
    songs = new SongService(rec.service);
    setlists = new SetlistService(songs);
    cursor = new SetlistCursorService(songs, setlists, rec.service);

    songA = songs.createSong('Song A').id;
    songs.captureScene(songA, 'A1');
    songs.captureScene(songA, 'A2');

    songB = songs.createSong('Song B').id;
    songs.captureScene(songB, 'B1');

    listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, songA);
    setlists.addSong(listId, songB);
    useCursorStore.getState().exit();
  });

  it('nextScene advances within the song', async () => {
    await cursor.enterPerform({setlistId: listId});
    await cursor.nextScene();
    expect(cursor.getCurrentScene()?.label).toBe('A2');
  });

  it('R1: nextScene is bounded — it never crosses into the next song', async () => {
    await cursor.enterPerform({setlistId: listId});
    await cursor.nextScene();
    const before = applied.length;
    await cursor.nextScene();
    expect(useCursorStore.getState().entryIndex).toBe(0);
    expect(cursor.getCurrentScene()?.label).toBe('A2');
    expect(applied).toHaveLength(before);
  });

  it('prevScene is bounded at scene 0', async () => {
    await cursor.enterPerform({setlistId: listId});
    const before = applied.length;
    await cursor.prevScene();
    expect(useCursorStore.getState().sceneIndex).toBe(0);
    expect(applied).toHaveLength(before);
  });

  it('nextSong moves to the next entry at scene 0', async () => {
    await cursor.enterPerform({setlistId: listId});
    await cursor.nextSong();
    expect(useCursorStore.getState().entryIndex).toBe(1);
    expect(cursor.getCurrentSong()?.id).toBe(songB);
    expect(cursor.getCurrentScene()?.label).toBe('B1');
  });

  it('nextSong at the last entry does nothing', async () => {
    await cursor.enterPerform({setlistId: listId});
    await cursor.nextSong();
    const before = applied.length;
    await cursor.nextSong();
    expect(useCursorStore.getState().entryIndex).toBe(1);
    expect(applied).toHaveLength(before);
  });

  it('prevSong moves back an entry', async () => {
    await cursor.enterPerform({setlistId: listId});
    await cursor.nextSong();
    await cursor.prevSong();
    expect(useCursorStore.getState().entryIndex).toBe(0);
  });

  it('nextSong skips a dangling entry', async () => {
    const doomed = songs.createSong('Doomed').id;
    songs.captureScene(doomed, 'X');
    setlists.addSong(listId, doomed);
    const tail = songs.createSong('Tail').id;
    songs.captureScene(tail, 'T1');
    setlists.addSong(listId, tail);
    songs.deleteSong(doomed);

    await cursor.enterPerform({setlistId: listId});
    await cursor.nextSong();
    await cursor.nextSong();
    expect(useCursorStore.getState().entryIndex).toBe(3);
    expect(cursor.getCurrentSong()?.id).toBe(tail);
  });

  it('R4: getNextTarget reports scene, then song, then end', async () => {
    await cursor.enterPerform({setlistId: listId});
    expect(cursor.getNextTarget()).toEqual({
      kind: 'scene',
      scene: expect.objectContaining({label: 'A2'}),
    });

    await cursor.nextScene();
    expect(cursor.isAtLastScene()).toBe(true);
    expect(cursor.getNextTarget()).toEqual({
      kind: 'song',
      song: expect.objectContaining({name: 'Song B'}),
    });

    await cursor.nextSong();
    expect(cursor.getNextTarget()).toEqual({kind: 'end'});
  });

  it('single-song mode never offers a next song', async () => {
    await cursor.enterPerform({songId: songA});
    await cursor.nextScene();
    expect(cursor.hasNextSong()).toBe(false);
    expect(cursor.getNextTarget()).toEqual({kind: 'end'});

    const before = applied.length;
    await cursor.nextSong();
    expect(applied).toHaveLength(before);
  });

  it('hasPrevSong is false at the first entry', async () => {
    await cursor.enterPerform({setlistId: listId});
    expect(cursor.hasPrevSong()).toBe(false);
  });

  it('hasPrevSong is true once past the first playable song', async () => {
    await cursor.enterPerform({setlistId: listId});
    await cursor.nextSong();
    expect(cursor.hasPrevSong()).toBe(true);
  });

  it('single-song mode never offers a prev song', async () => {
    await cursor.enterPerform({songId: songA});
    expect(cursor.hasPrevSong()).toBe(false);
  });

  it('hasPrevSong is false when the only earlier entry is scene-less', async () => {
    const empty = songs.createSong('Empty').id;
    const list2 = setlists.createSetlist('Gig 2').id;
    setlists.addSong(list2, empty);
    setlists.addSong(list2, songA);

    await cursor.enterPerform({setlistId: list2});
    expect(useCursorStore.getState().entryIndex).toBe(1);
    expect(cursor.hasPrevSong()).toBe(false);
  });
});
