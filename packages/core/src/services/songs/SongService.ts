/**
 * SongService — song and scene CRUD scoped to the active profile.
 *
 * Deliberately separate from `ProfileService`, which already carries profile
 * lifecycle, preference sync, preset CRUD and export/import across 675 lines.
 *
 * Snapshot capture delegates to `PresetService.captureSnapshot()` — a scene
 * and a pad capture identical state (design D8).
 */

import {requireActiveProfile, writeActiveProfile} from '../activeProfile';
import {generateProfileId} from '../../helpers/profileId';
import {
  appendScene,
  autoSceneLabel,
  buildScene,
  moveSceneInSong,
  patchScene,
  removeScene,
  sceneFromPad,
} from '../../helpers/songEdits';
import type {Preset, Profile} from '../../types/profile';
import {SceneNotFoundError, SongNotFoundError} from '../../types/setlist';
import type {Scene, Song} from '../../types/setlist';
import type {PresetService} from '../presets/PresetService';

export class SongService {
  private presetService: PresetService;

  constructor(presetService: PresetService) {
    this.presetService = presetService;
  }

  // ─── Songs ───────────────────────────────────────────────────

  listSongs(): Song[] {
    return this._activeProfile().songs;
  }

  getSong(songId: string): Song | null {
    return this._activeProfile().songs.find(s => s.id === songId) ?? null;
  }

  createSong(name: string): Song {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Song name cannot be empty.');

    const now = new Date().toISOString();
    const song: Song = {
      id: generateProfileId(),
      name: trimmed,
      scenes: [],
      createdAt: now,
      updatedAt: now,
    };

    this._write(profile => ({...profile, songs: [...profile.songs, song]}));
    return song;
  }

  renameSong(songId: string, name: string): Song {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Song name cannot be empty.');
    return this._patchSong(songId, song => ({...song, name: trimmed}));
  }

  setSongNotes(songId: string, notes: string): Song {
    return this._patchSong(songId, song => ({...song, notes}));
  }

  deleteSong(songId: string): void {
    const exists = this._activeProfile().songs.some(s => s.id === songId);
    if (!exists) throw new SongNotFoundError(songId);
    this._write(profile => ({
      ...profile,
      songs: profile.songs.filter(s => s.id !== songId),
    }));
  }

  // ─── Scenes ──────────────────────────────────────────────────

  /**
   * Capture the current performance state as a new scene appended to the end
   * of the song. Auto-labels "Scene N" when no label is given.
   */
  captureScene(songId: string, label?: string): Scene {
    const song = this.getSong(songId);
    if (!song) throw new SongNotFoundError(songId);

    // `undefined` means "auto-label me"; an explicit-but-blank string is
    // caller error and must be rejected the same way `renameScene` does.
    let resolvedLabel: string;
    if (label === undefined) {
      resolvedLabel = autoSceneLabel(song);
    } else {
      resolvedLabel = label.trim();
      if (!resolvedLabel) throw new Error('Scene label cannot be empty.');
    }

    const scene = buildScene(resolvedLabel, this.presetService.captureSnapshot());
    this._patchSong(songId, s => appendScene(s, scene));
    return scene;
  }

  /** Replace a scene's snapshot with current state, keeping label and notes. */
  recaptureScene(songId: string, sceneId: string): Scene {
    return this._patchScene(songId, sceneId, scene => ({
      ...scene,
      snapshot: this.presetService.captureSnapshot(),
    }));
  }

  renameScene(songId: string, sceneId: string, label: string): Scene {
    const trimmed = label.trim();
    if (!trimmed) throw new Error('Scene label cannot be empty.');
    return this._patchScene(songId, sceneId, scene => ({...scene, label: trimmed}));
  }

  setSceneNotes(songId: string, sceneId: string, notes: string): Scene {
    return this._patchScene(songId, sceneId, scene => ({...scene, notes}));
  }

  /** Reorder by array position (design D2). Indices are clamped, not validated. */
  moveScene(songId: string, from: number, to: number): Song {
    const song = this.getSong(songId);
    if (!song) throw new SongNotFoundError(songId);

    // Decide up front whether this is a no-op so we can skip the write (and
    // the updatedAt stamp) entirely. The actual write below re-derives the
    // move from `_patchSong`'s freshly-resolved song, per its normal
    // "patch the song you're handed" contract, rather than reusing this
    // outer `song` reference.
    if (moveSceneInSong(song, from, to) === song) return song;
    return this._patchSong(songId, s => moveSceneInSong(s, from, to));
  }

  deleteScene(songId: string, sceneId: string): void {
    this._patchSong(songId, s => removeScene(s, sceneId));
  }

  /**
   * Copy a pad into this song as a scene (design D1 — copy, never link).
   * A fresh id is minted and the snapshot is deep-copied so later edits to
   * either side stay independent.
   */
  addPadAsScene(songId: string, pad: Preset): Scene {
    const song = this.getSong(songId);
    if (!song) throw new SongNotFoundError(songId);

    const scene = sceneFromPad(pad);
    this._patchSong(songId, s => appendScene(s, scene));
    return scene;
  }

  /** Patch one scene inside one song, refreshing its `updatedAt`. Delegates to the pure `patchScene` helper. */
  protected _patchScene(
    songId: string,
    sceneId: string,
    patch: (scene: Scene) => Scene,
  ): Scene {
    const next = this._patchSong(songId, s => patchScene(s, sceneId, patch));
    // Re-find by id rather than assuming position: defensive against a
    // future `patch` that reorders `next.scenes`. If `patch` ever rewrote
    // `scene.id` itself, this would legitimately fail to find it — surface
    // that as the same SceneNotFoundError callers already handle, not an
    // `undefined` silently typed as `Scene`.
    const patched = next.scenes.find(s => s.id === sceneId);
    if (!patched) throw new SceneNotFoundError(sceneId);
    return patched;
  }

  // ─── Internals ───────────────────────────────────────────────

  /** Patch one song in place, refreshing its `updatedAt`. */
  protected _patchSong(songId: string, patch: (song: Song) => Song): Song {
    const existing = this.getSong(songId);
    if (!existing) throw new SongNotFoundError(songId);

    const now = new Date().toISOString();
    const next: Song = {...patch(existing), updatedAt: now};
    this._write(profile => ({
      ...profile,
      songs: profile.songs.map(s => (s.id === songId ? next : s)),
    }));
    return next;
  }

  protected _activeProfile(): Profile {
    return requireActiveProfile();
  }

  protected _write(patch: (profile: Profile) => Profile): void {
    writeActiveProfile(patch);
  }
}
