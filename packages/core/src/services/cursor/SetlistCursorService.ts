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
  private inFlight: Promise<void> | null = null;
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

  async enterPerform(opts: {setlistId: string} | {songId: string}): Promise<void> {
    if ('setlistId' in opts) {
      const list = this.setlistService.getSetlist(opts.setlistId);
      if (!list) throw new SetlistNotFoundError(opts.setlistId);

      const playable = this._firstPlayableEntry(list);
      if (!playable) throw new EmptySetlistError(list.name);

      useCursorStore.getState().enter({
        setlistId: opts.setlistId,
        songId: list.entries[playable.entryIndex].songId,
        entryIndex: playable.entryIndex,
      });
    } else {
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

    const entry = this.setlistService.getSetlist(setlistId)?.entries[entryIndex];
    const song = this.setlistService.resolveEntry(setlistId, entryIndex);
    if (!entry || !song || song.scenes.length === 0) return;

    useCursorStore.getState().setPosition({
      songId: entry.songId,
      entryIndex,
      sceneIndex: 0,
    });
    await this._applyCurrent();
  }

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

  isAtLastScene(): boolean {
    const song = this.getCurrentSong();
    if (!song) return false;
    return useCursorStore.getState().sceneIndex >= song.scenes.length - 1;
  }

  hasNextSong(): boolean {
    return this._findPlayableEntry(1) !== null;
  }

  hasPrevSong(): boolean {
    return this._findPlayableEntry(-1) !== null;
  }

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
    const {setlistId} = useCursorStore.getState();
    if (entryIndex !== null && setlistId !== null) {
      const next = this.setlistService.resolveEntry(setlistId, entryIndex);
      if (next) return {kind: 'song', song: next};
    }

    return {kind: 'end'};
  }

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

  protected _firstPlayableEntry(
    list: Setlist,
  ): {song: Song; entryIndex: number} | null {
    for (let i = 0; i < list.entries.length; i++) {
      const song = this.setlistService.resolveEntry(list.id, i);
      if (song && song.scenes.length > 0) return {song, entryIndex: i};
    }
    return null;
  }

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
        }
      } while (this.pending);
    };

    this.inFlight = run().finally(() => {
      this.inFlight = null;
      if (this.pending) {
        this.pending = false;
        void this._applyCurrent();
      }
    });
    return this.inFlight;
  }
}
