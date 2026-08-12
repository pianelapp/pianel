/**
 * Pure Song/Scene transforms.
 *
 * Extracted from `SongService`'s scene methods so the exact same rules —
 * index clamping, `SceneNotFoundError`, the deep-copy on pad import, the
 * auto-label formula — can also be applied to a setlist entry's `override`
 * (a detached `Song` clone) via `SetlistService.editOverride`, without
 * `SongService` widening its addressing model to reach into
 * `SetlistEntry.override`.
 *
 * Pure: no store access, no service dependencies, no mutation of inputs.
 * Every function takes a `Song` (or `Scene`) and returns a new one.
 */

import {generateProfileId} from './profileId';
import {SceneNotFoundError} from '../types/setlist';
import type {Scene, Song} from '../types/setlist';
import type {Preset} from '../types/profile';
import type {PerformanceSnapshot} from '../types/performanceSnapshot';

/**
 * Build a brand-new scene: fresh id, `createdAt === updatedAt`, notes default
 * to `''`. `snapshot` is taken by reference, not cloned — callers that need
 * the new scene to be independent of an existing snapshot object (e.g. one
 * already stored on another scene, song, or preset) must pre-clone it before
 * calling. `sceneFromPad` is the example of a caller that needs that and
 * clones before delegating here.
 */
export function buildScene(
  label: string,
  snapshot: PerformanceSnapshot,
  notes = '',
): Scene {
  const now = new Date().toISOString();
  return {
    id: generateProfileId(),
    label,
    notes,
    snapshot,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Copy a pad into a scene (design D1 — copy, never link). A fresh id is
 * minted and the snapshot is deep-copied so later edits to either side stay
 * independent. Only `label` and `snapshot` carry over — never `tilePosition`,
 * which has no meaning inside a song.
 */
export function sceneFromPad(pad: Preset): Scene {
  // Deep clone via JSON round-trip: safe today because PerformanceSnapshot
  // is plain data (numbers/strings/null/nested plain objects and arrays).
  // Revisit this if that type ever grows a `Date`, `Map`/`Set`, or a
  // meaningful `undefined`-valued key — JSON would silently drop/mangle those.
  return buildScene(pad.label, JSON.parse(JSON.stringify(pad.snapshot)));
}

/** `Scene N` where N is one past the song's current scene count. */
export function autoSceneLabel(song: Song): string {
  return `Scene ${song.scenes.length + 1}`;
}

/** Append a scene to the end of a song. Does not mutate `song`. */
export function appendScene(song: Song, scene: Scene): Song {
  return {...song, scenes: [...song.scenes, scene]};
}

/**
 * Apply `patch` to the scene with `sceneId`, stamping only that scene's
 * `updatedAt`. The song's own `updatedAt` is left untouched here — callers
 * (`SongService._patchSong`, `SetlistService.editOverride`) stamp it
 * themselves as part of their own write. Throws `SceneNotFoundError` for an
 * unknown id.
 */
export function patchScene(
  song: Song,
  sceneId: string,
  patch: (scene: Scene) => Scene,
): Song {
  const existing = song.scenes.find(s => s.id === sceneId);
  if (!existing) throw new SceneNotFoundError(sceneId);

  const next: Scene = {...patch(existing), updatedAt: new Date().toISOString()};
  return {
    ...song,
    scenes: song.scenes.map(scene => (scene.id === sceneId ? next : scene)),
  };
}

/**
 * Reorder by array position (design D2). Indices are clamped, not validated.
 * Returns `song` unchanged (the same reference) when the clamped indices
 * match — including the zero-scene case, where `scenes.length - 1` is `-1`
 * and both `from`/`to` clamp to `0`.
 */
export function moveSceneInSong(song: Song, from: number, to: number): Song {
  const last = song.scenes.length - 1;
  const src = Math.max(0, Math.min(last, from));
  const dest = Math.max(0, Math.min(last, to));
  if (src === dest) return song;

  const scenes = [...song.scenes];
  const [moved] = scenes.splice(src, 1);
  scenes.splice(dest, 0, moved);
  return {...song, scenes};
}

/** Remove a scene by id, preserving the order of the rest. Throws `SceneNotFoundError` for an unknown id. */
export function removeScene(song: Song, sceneId: string): Song {
  if (!song.scenes.some(s => s.id === sceneId)) {
    throw new SceneNotFoundError(sceneId);
  }
  return {...song, scenes: song.scenes.filter(scene => scene.id !== sceneId)};
}
