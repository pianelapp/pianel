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
      resolvedLabel = `Scene ${song.scenes.length + 1}`;
    } else {
      resolvedLabel = label.trim();
      if (!resolvedLabel) throw new Error('Scene label cannot be empty.');
    }

    const now = new Date().toISOString();
    const scene: Scene = {
      id: generateProfileId(),
      label: resolvedLabel,
      notes: '',
      snapshot: this.presetService.captureSnapshot(),
      createdAt: now,
      updatedAt: now,
    };

    this._patchSong(songId, s => ({...s, scenes: [...s.scenes, scene]}));
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

    const last = song.scenes.length - 1;
    const src = Math.max(0, Math.min(last, from));
    const dest = Math.max(0, Math.min(last, to));
    if (src === dest) return song;

    const scenes = [...song.scenes];
    const [moved] = scenes.splice(src, 1);
    scenes.splice(dest, 0, moved);
    return this._patchSong(songId, s => ({...s, scenes}));
  }

  deleteScene(songId: string, sceneId: string): void {
    const song = this.getSong(songId);
    if (!song) throw new SongNotFoundError(songId);
    if (!song.scenes.some(s => s.id === sceneId)) {
      throw new SceneNotFoundError(sceneId);
    }
    this._patchSong(songId, s => ({
      ...s,
      scenes: s.scenes.filter(scene => scene.id !== sceneId),
    }));
  }

  /**
   * Copy a pad into this song as a scene (design D1 — copy, never link).
   * A fresh id is minted and the snapshot is deep-copied so later edits to
   * either side stay independent.
   */
  addPadAsScene(songId: string, pad: Preset): Scene {
    const song = this.getSong(songId);
    if (!song) throw new SongNotFoundError(songId);

    const now = new Date().toISOString();
    const scene: Scene = {
      id: generateProfileId(),
      label: pad.label,
      notes: '',
      // Deep clone via JSON round-trip: safe today because PerformanceSnapshot
      // is plain data (numbers/strings/null/nested plain objects and arrays).
      // Revisit this if that type ever grows a `Date`, `Map`/`Set`, or a
      // meaningful `undefined`-valued key — JSON would silently drop/mangle those.
      snapshot: JSON.parse(JSON.stringify(pad.snapshot)),
      createdAt: now,
      updatedAt: now,
    };

    this._patchSong(songId, s => ({...s, scenes: [...s.scenes, scene]}));
    return scene;
  }

  /** Patch one scene inside one song, refreshing its `updatedAt`. */
  protected _patchScene(
    songId: string,
    sceneId: string,
    patch: (scene: Scene) => Scene,
  ): Scene {
    const song = this.getSong(songId);
    if (!song) throw new SongNotFoundError(songId);
    const existing = song.scenes.find(s => s.id === sceneId);
    if (!existing) throw new SceneNotFoundError(sceneId);

    const next: Scene = {...patch(existing), updatedAt: new Date().toISOString()};
    this._patchSong(songId, s => ({
      ...s,
      scenes: s.scenes.map(scene => (scene.id === sceneId ? next : scene)),
    }));
    return next;
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
