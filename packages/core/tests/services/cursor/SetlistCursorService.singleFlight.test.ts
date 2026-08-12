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

/** An applySnapshot whose completion the test controls. */
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

  /**
   * Release every queued gate, yielding to the event loop between rounds so a
   * coalesced follow-up apply can open its own gate and be released too.
   *
   * Releasing once is NOT enough and must not be simplified back: the pending
   * slot opens a second gate only after the first apply resolves, so a single
   * release followed by an await deadlocks.
   */
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
    // Five scenes with tempos 1..5, so applied order is assertable.
    for (let i = 0; i < 5; i++) songs.captureScene(songId, `S${i}`);

    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, songId);
    useCursorStore.getState().exit();

    const entering = cursor.enterPerform({setlistId: listId});
    await drain();
    await entering;
    applied.length = 0; // discard the enter-time apply, leaving tempos 2..5
  });

  it('coalesces rapid advances to the latest scene', async () => {
    // Three presses with no awaits between them.
    const p1 = cursor.nextScene();
    const p2 = cursor.nextScene();
    const p3 = cursor.nextScene();

    // Only the first request is in flight; 2 and 3 collapse into one pending.
    expect(applied).toHaveLength(1);

    await drain();
    await Promise.all([p1, p2, p3]);

    // Scene index 1 (tempo 2) then scene index 3 (tempo 4). Scene index 2
    // (tempo 3) was skipped rather than sent — the intermediate state never
    // reaches the piano.
    expect(applied).toEqual([2, 4]);
    expect(useCursorStore.getState().sceneIndex).toBe(3);
  });

  it('applies the final cursor position after the queue drains', async () => {
    // Three jumps, not two: with only jumpToScene(1) then jumpToScene(4),
    // removing coalescing entirely still produces [2, 5] by coincidence
    // (nothing to skip), so that shape doesn't discriminate. A middle jump
    // to scene 2 (tempo 3) does — coalesced gives [2, 5], uncoalesced gives
    // [2, 3, 5].
    const p1 = cursor.jumpToScene(1);
    const p2 = cursor.jumpToScene(2);
    const p3 = cursor.jumpToScene(4);

    await drain();
    await Promise.all([p1, p2, p3]);

    // Scene index 1 (tempo 2), then the coalesced jump to index 4 (tempo 5).
    // Scene index 2 (tempo 3) was skipped rather than sent.
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
    // The cursor still moves even though the apply threw.
    await c.nextScene();
    expect(useCursorStore.getState().sceneIndex).toBe(1);
    // Two distinct applies actually fired (enter + nextScene). If a
    // rejection failed to clear `inFlight`, the second call would just
    // re-await the first (already-settled) flight and never invoke
    // `applySnapshot` again — the cursor would still move (setPosition is
    // synchronous and independent of the apply queue) but the queue would be
    // permanently wedged. Counting calls is what actually proves the queue
    // unwedges; the sceneIndex assertion alone does not.
    expect(calls).toBe(2);
  });

  it('does not drop a request that lands on a microtask during the settle window', async () => {
    // `inFlight` is cleared from a `.finally` callback, which runs one
    // microtask AFTER `run()`'s own promise settles — not synchronously with
    // the do-while loop deciding to exit. A request that calls
    // `_applyCurrent()` in that exact window sees `inFlight` still non-null,
    // sets `pending`, and (without the fix) has no loop left to ever read
    // it: silently dropped even though `setPosition` already moved the
    // cursor. `drain()` above yields via `setImmediate`, a macrotask, and the
    // microtask queue always fully drains between macrotasks — so it can
    // never land inside this window. Only a microtask-scheduled follow-up
    // (`Promise.resolve().then(...)`) can actually race it.
    // A holder object rather than a bare `let`: TS's flow narrowing on a
    // plain `let` reassigned only inside a closure collapses it to `never`
    // at later read sites, which a property access avoids.
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

    const entering = c.enterPerform({songId}); // scene 0, tempo 1
    gate.resolve!();
    await entering;
    tempos.length = 0;

    c.nextScene(); // scene index -> 1, tempo 2, gated in flight
    expect(tempos).toEqual([2]);

    // Release the in-flight gate, then in the SAME synchronous turn queue a
    // follow-up request as a microtask. This is the exact interleaving from
    // the doc comment: the resume of `run()`'s await and the resume of this
    // `.then()` callback are both already-queued microtasks, racing the
    // `.finally` callback that clears `inFlight`.
    gate.resolve!();
    Promise.resolve().then(() => {
      c.nextScene(); // scene index -> 2, tempo 3 — must not be dropped
    });

    // Flush microtasks (no macrotask boundary, deliberately) so the race
    // plays out and, if the fix is in place, the restart gets to make its
    // own applySnapshot call and open its own gate.
    for (let i = 0; i < 20; i++) await Promise.resolve();

    expect(tempos).toEqual([2, 3]);
    expect(useCursorStore.getState().sceneIndex).toBe(2);

    // Let the restart's own apply resolve so nothing is left hanging.
    gate.resolve?.();
    await Promise.resolve();
  });
});
