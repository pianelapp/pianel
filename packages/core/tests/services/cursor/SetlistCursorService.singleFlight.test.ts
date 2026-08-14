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

function gatedPresetService() {
  const applied: number[] = [];
  const gates: Array<() => void> = [];
  let tempo = 1;
  const service = {
    captureSnapshot: () => ({...DEFAULT_PERFORMANCE_SNAPSHOT, tempo: tempo++}),
    applySnapshot: (snapshot: PerformanceSnapshot) => {
      applied.push(snapshot.tempo);
      return new Promise<void>(resolve => gates.push(resolve));
    },
  } as unknown as PresetService;

  const drain = async (): Promise<void> => {
    for (let round = 0; round < 10; round++) {
      while (gates.length) gates.shift()!();
      await new Promise(resolve => setImmediate(resolve));
    }
  };

  return {service, applied, drain};
}

describe('SetlistCursorService single-flight (R3)', () => {
  let cursor: SetlistCursorService;
  let applied: number[];
  let drain: () => Promise<void>;

  beforeEach(async () => {
    await inMemoryStorage.removeItem('pianel:profiles');
    const store = createProfilesStore({storage: inMemoryStorage});
    const profile = makeProfile();
    store.getState().addProfile(profile);
    store.getState().setActiveProfileId(profile.id);

    const gated = gatedPresetService();
    applied = gated.applied;
    drain = gated.drain;

    const songs = new SongService(gated.service);
    const setlists = new SetlistService(songs);
    cursor = new SetlistCursorService(songs, setlists, gated.service);

    const songId = songs.createSong('Long Song').id;
    for (let i = 0; i < 5; i++) songs.captureScene(songId, `S${i}`);

    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, songId);
    useCursorStore.getState().exit();

    const entering = cursor.enterPerform({setlistId: listId});
    await drain();
    await entering;
    applied.length = 0;
  });

  it('coalesces rapid advances to the latest scene', async () => {
    const p1 = cursor.nextScene();
    const p2 = cursor.nextScene();
    const p3 = cursor.nextScene();

    expect(applied).toHaveLength(1);

    await drain();
    await Promise.all([p1, p2, p3]);

    expect(applied).toEqual([2, 4]);
    expect(useCursorStore.getState().sceneIndex).toBe(3);
  });

  it('applies the final cursor position after the queue drains', async () => {
    const p1 = cursor.jumpToScene(1);
    const p2 = cursor.jumpToScene(2);
    const p3 = cursor.jumpToScene(4);

    await drain();
    await Promise.all([p1, p2, p3]);

    expect(applied).toEqual([2, 5]);
  });

  it('a rejected apply does not wedge the queue', async () => {
    let calls = 0;
    const failing = {
      captureSnapshot: () => ({...DEFAULT_PERFORMANCE_SNAPSHOT}),
      applySnapshot: async () => {
        calls++;
        throw new Error('transport died');
      },
    } as unknown as PresetService;

    const songs = new SongService(failing);
    const setlists = new SetlistService(songs);
    const c = new SetlistCursorService(songs, setlists, failing);
    const songId = songs.createSong('S').id;
    songs.captureScene(songId, 'One');
    songs.captureScene(songId, 'Two');

    await expect(c.enterPerform({songId})).resolves.toBeUndefined();
    await c.nextScene();
    expect(useCursorStore.getState().sceneIndex).toBe(1);
    expect(calls).toBe(2);
  });

  it('does not drop a request that lands on a microtask during the settle window', async () => {
    const gate: {resolve: (() => void) | null} = {resolve: null};
    let tempo = 1;
    const tempos: number[] = [];
    const controlled = {
      captureSnapshot: () => ({...DEFAULT_PERFORMANCE_SNAPSHOT, tempo: tempo++}),
      applySnapshot: (snapshot: PerformanceSnapshot) => {
        tempos.push(snapshot.tempo);
        return new Promise<void>(resolve => {
          gate.resolve = resolve;
        });
      },
    } as unknown as PresetService;

    const songs = new SongService(controlled);
    const setlists = new SetlistService(songs);
    const c = new SetlistCursorService(songs, setlists, controlled);
    const songId = songs.createSong('Race').id;
    for (let i = 0; i < 3; i++) songs.captureScene(songId, `R${i}`);

    const entering = c.enterPerform({songId});
    gate.resolve!();
    await entering;
    tempos.length = 0;

    c.nextScene();
    expect(tempos).toEqual([2]);

    gate.resolve!();
    Promise.resolve().then(() => {
      c.nextScene();
    });

    for (let i = 0; i < 20; i++) await Promise.resolve();

    expect(tempos).toEqual([2, 3]);
    expect(useCursorStore.getState().sceneIndex).toBe(2);

    gate.resolve?.();
    await Promise.resolve();
  });
});
