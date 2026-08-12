/**
 * SetlistCursorService — headless perform-time navigation (design §4).
 *
 * Built before any UI on purpose: the perform screen and the MIDI foot
 * controller are both clients of this API. Building the UI first would have
 * forced hands-free control to reach into React state.
 *
 * Rule R2: in perform mode, moving the cursor always applies. There is no
 * preview-then-commit, so there is no "highlighted but not playing" state to
 * misread on stage.
 */

import {useCursorStore} from '../../store/cursorStore';
import {
  EmptySetlistError,
  EmptySongError,
  SetlistNotFoundError,
  SongNotFoundError,
} from '../../types/setlist';
import type {Scene, Setlist, Song} from '../../types/setlist';
import type {PresetService} from '../presets/PresetService';
import type {SetlistService} from '../setlists/SetlistService';
import type {SongService} from '../songs/SongService';

export class SetlistCursorService {
  private songService: SongService;
  private setlistService: SetlistService;
  private presetService: PresetService;
  /** Non-null while a DT1 apply is in flight (R3). */
  private inFlight: Promise<void> | null = null;
  /** At most one queued follow-up; later requests overwrite it (latest wins). */
  private pending = false;

  constructor(
    songService: SongService,
    setlistService: SetlistService,
    presetService: PresetService,
  ) {
    this.songService = songService;
    this.setlistService = setlistService;
    this.presetService = presetService;
  }

  // ─── Lifecycle ───────────────────────────────────────────────

  async enterPerform(opts: {setlistId: string} | {songId: string}): Promise<void> {
    if ('setlistId' in opts) {
      // Setlist path: the lookup itself and "nothing playable inside it" are
      // two distinct failures, so each gets its own error type rather than
      // both collapsing into a mislabeled "song not found".
      const list = this.setlistService.getSetlist(opts.setlistId);
      if (!list) throw new SetlistNotFoundError(opts.setlistId);

      const playable = this._firstPlayableEntry(list);
      if (!playable) throw new EmptySetlistError(list.name);

      useCursorStore.getState().enter({
        setlistId: opts.setlistId,
        songId: playable.song.id,
        entryIndex: playable.entryIndex,
      });
    } else {
      // Single-song path: unchanged from before this fix.
      const song = this.songService.getSong(opts.songId);
      if (!song) throw new SongNotFoundError(opts.songId);
      if (song.scenes.length === 0) throw new EmptySongError(song.name);

      useCursorStore.getState().enter({
        setlistId: null,
        songId: song.id,
        entryIndex: 0,
      });
    }

    await this._applyCurrent();
  }

  exitPerform(): void {
    useCursorStore.getState().exit();
  }

  // ─── Reads ───────────────────────────────────────────────────

  getCurrentSong(): Song | null {
    const {setlistId, entryIndex, songId} = useCursorStore.getState();
    if (setlistId === null) return this.songService.getSong(songId);
    return this.setlistService.resolveEntry(setlistId, entryIndex);
  }

  getCurrentScene(): Scene | null {
    const song = this.getCurrentSong();
    if (!song) return null;
    return song.scenes[useCursorStore.getState().sceneIndex] ?? null;
  }

  // ─── Jumps ───────────────────────────────────────────────────

  async jumpToScene(sceneIndex: number): Promise<void> {
    const song = this.getCurrentSong();
    if (!song) return;
    if (sceneIndex < 0 || sceneIndex >= song.scenes.length) return;

    useCursorStore.getState().setPosition({sceneIndex});
    await this._applyCurrent();
  }

  async jumpToSong(entryIndex: number): Promise<void> {
    const {setlistId} = useCursorStore.getState();
    if (setlistId === null) return;

    const song = this.setlistService.resolveEntry(setlistId, entryIndex);
    // Dangling reference or empty song — leave the cursor where it is rather
    // than stranding the performer on a song that cannot be played.
    if (!song || song.scenes.length === 0) return;

    useCursorStore.getState().setPosition({
      songId: song.id,
      entryIndex,
      sceneIndex: 0,
    });
    await this._applyCurrent();
  }

  // ─── Sequential navigation ───────────────────────────────────

  /**
   * R1: bounded. Stops at the last scene of the song and never rolls into the
   * next song. Crossing a song boundary is always a deliberate `nextSong()`.
   */
  async nextScene(): Promise<void> {
    const song = this.getCurrentSong();
    if (!song) return;
    const next = useCursorStore.getState().sceneIndex + 1;
    if (next >= song.scenes.length) return;
    await this.jumpToScene(next);
  }

  async prevScene(): Promise<void> {
    const prev = useCursorStore.getState().sceneIndex - 1;
    if (prev < 0) return;
    await this.jumpToScene(prev);
  }

  async nextSong(): Promise<void> {
    const target = this._findPlayableEntry(1);
    if (target === null) return;
    await this.jumpToSong(target);
  }

  async prevSong(): Promise<void> {
    const target = this._findPlayableEntry(-1);
    if (target === null) return;
    await this.jumpToSong(target);
  }

  // ─── Button-state reads (R4) ─────────────────────────────────

  isAtLastScene(): boolean {
    const song = this.getCurrentSong();
    if (!song) return false;
    return useCursorStore.getState().sceneIndex >= song.scenes.length - 1;
  }

  hasNextSong(): boolean {
    return this._findPlayableEntry(1) !== null;
  }

  /**
   * What the primary button should do and say right now — the three states in
   * design §5: advance a scene, cross to the next song, or nothing left.
   */
  getNextTarget():
    | {kind: 'scene'; scene: Scene}
    | {kind: 'song'; song: Song}
    | {kind: 'end'} {
    const song = this.getCurrentSong();
    if (song && !this.isAtLastScene()) {
      const scene = song.scenes[useCursorStore.getState().sceneIndex + 1];
      if (scene) return {kind: 'scene', scene};
    }

    const entryIndex = this._findPlayableEntry(1);
    if (entryIndex !== null) {
      const {setlistId} = useCursorStore.getState();
      const next =
        setlistId === null
          ? null
          : this.setlistService.resolveEntry(setlistId, entryIndex);
      if (next) return {kind: 'song', song: next};
    }

    return {kind: 'end'};
  }

  /**
   * Walk the setlist in `step` direction for the next entry that resolves to a
   * song with scenes, skipping dangling references. Null when none exists or
   * we are in single-song mode.
   */
  protected _findPlayableEntry(step: 1 | -1): number | null {
    const {setlistId, entryIndex} = useCursorStore.getState();
    if (setlistId === null) return null;

    const list = this.setlistService.getSetlist(setlistId);
    if (!list) return null;

    for (let i = entryIndex + step; i >= 0 && i < list.entries.length; i += step) {
      const song = this.setlistService.resolveEntry(setlistId, i);
      if (song && song.scenes.length > 0) return i;
    }
    return null;
  }

  // ─── Internals ───────────────────────────────────────────────

  /**
   * First entry in an already-resolved setlist that resolves to a song with
   * scenes. `null` when nothing in the setlist is playable (empty, or every
   * entry dangling or resolving to an empty song) — the caller distinguishes
   * that from "setlist not found" itself.
   */
  protected _firstPlayableEntry(
    list: Setlist,
  ): {song: Song; entryIndex: number} | null {
    for (let i = 0; i < list.entries.length; i++) {
      const song = this.setlistService.resolveEntry(list.id, i);
      if (song && song.scenes.length > 0) return {song, entryIndex: i};
    }
    return null;
  }

  /**
   * R3: single-flight with latest-wins coalescing.
   *
   * `applySnapshot` sends a DT1 batch and awaits an RQ1 read-back, so two fast
   * presses would otherwise interleave batches and let a stale read-back
   * clobber newer state. While one apply is in flight we mark a single pending
   * slot; when the flight lands we apply whatever the cursor points at *then*.
   * Intermediate scenes are skipped rather than sent.
   *
   * Apply failures are swallowed: the cursor must keep moving when the piano
   * is disconnected, and the UI reports that separately via a banner. The
   * scene read is inside the `try` too, so `run()` can never reject —
   * required for the restart below to never produce an unhandled rejection.
   *
   * `inFlight` is cleared from the `.finally` callback chained onto `run()`,
   * which fires one microtask AFTER `run()`'s own promise settles — not
   * synchronously with the do-while loop deciding to exit. A request that
   * calls `_applyCurrent()` in that exact window would see `inFlight` still
   * non-null, set `pending`, and have no loop left to ever observe it —
   * dropped silently, even though the caller's `setPosition` already moved
   * the cursor. The `finally` callback re-checks `pending` and restarts the
   * apply itself to close that window. (This can only be reached by a
   * request chained on a microtask, e.g. `Promise.resolve().then(...)`; a
   * macrotask-sourced request such as a UI tap or a MIDI callback can never
   * land inside it, because the microtask queue always fully drains before
   * the next macrotask runs.)
   *
   * Do not move `this.inFlight = null` into a try/finally inside `run()`
   * itself: on the synchronous "!scene" break path `run()` can complete
   * before the outer `this.inFlight = run()` assignment below executes, so
   * an inner finally would null the field first and the assignment would
   * then overwrite it with an already-settled promise nothing ever clears —
   * a permanent wedge, worse than the bug being fixed here.
   */
  protected async _applyCurrent(): Promise<void> {
    if (this.inFlight) {
      this.pending = true;
      return this.inFlight;
    }

    const run = async (): Promise<void> => {
      do {
        this.pending = false;
        try {
          const scene = this.getCurrentScene();
          if (!scene) break;
          await this.presetService.applySnapshot(scene.snapshot);
        } catch {
          // Non-fatal — see doc comment.
        }
      } while (this.pending);
    };

    this.inFlight = run().finally(() => {
      this.inFlight = null;
      // A request that arrived during the settle window above has no loop
      // left to observe `pending` — restart here rather than dropping it.
      if (this.pending) {
        this.pending = false;
        void this._applyCurrent();
      }
    });
    return this.inFlight;
  }
}
