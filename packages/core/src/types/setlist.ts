/**
 * Song / Scene / Setlist types (design §3).
 *
 * A Scene and a Preset are both a labeled PerformanceSnapshot. They are the
 * same shape in different collections and are COPIED between them, never
 * linked (design D1) — a pad's value is positional muscle memory, a scene's
 * is contextual order.
 *
 * Order is array position throughout. There is deliberately no `sortOrder`
 * field (design D2).
 */

import type {PerformanceSnapshot} from './performanceSnapshot';

/** Profile schema version emitted by this build (design D7). */
export const CURRENT_SCHEMA_VERSION = 2;

/** One recallable performance state inside a song. */
export interface Scene {
  /** `<unix-ms>-<random>`. Unique within the parent song. */
  id: string;
  /** User-visible label, e.g. "Chorus". */
  label: string;
  /** Free-text stage cue. Empty string when unset — never undefined. */
  notes: string;
  /** Full captured state. Identical shape to `Preset.snapshot`. */
  snapshot: PerformanceSnapshot;
  createdAt: string;
  updatedAt: string;
}

/** A song: an ordered, unbounded list of scenes. */
export interface Song {
  id: string;
  name: string;
  /** Song-level cue, e.g. "count in 4". */
  notes?: string;
  /** ORDERED. Position in this array is the performance order. */
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}

/**
 * One slot in a setlist. `override` is a full copy-on-write clone of the
 * library song (design D3) — not a sparse patch. `null` means "use the
 * library song identified by songId".
 */
export interface SetlistEntry {
  songId: string;
  override: Song | null;
}

/** An ordered gig. */
export interface Setlist {
  id: string;
  name: string;
  /** ORDERED. Position is the running order. */
  entries: SetlistEntry[];
  createdAt: string;
  updatedAt: string;
}

// ─── Errors ─────────────────────────────────────────────────────

export class SongNotFoundError extends Error {
  readonly code = 'song_not_found';
  constructor(id: string) {
    super(`No song with id "${id}".`);
    this.name = 'SongNotFoundError';
  }
}

export class SceneNotFoundError extends Error {
  readonly code = 'scene_not_found';
  constructor(id: string) {
    super(`No scene with id "${id}".`);
    this.name = 'SceneNotFoundError';
  }
}

export class SetlistNotFoundError extends Error {
  readonly code = 'setlist_not_found';
  constructor(id: string) {
    super(`No setlist with id "${id}".`);
    this.name = 'SetlistNotFoundError';
  }
}

export class EmptySongError extends Error {
  readonly code = 'empty_song';
  constructor(name: string) {
    super(`Song "${name}" has no scenes to perform.`);
    this.name = 'EmptySongError';
  }
}

/**
 * A setlist has no entry that can be performed — it is empty, or every entry
 * is dangling or resolves to a song with no scenes. Reachable in normal use,
 * so callers get a distinct type rather than a mislabeled song error.
 */
export class EmptySetlistError extends Error {
  readonly code = 'empty_setlist';
  constructor(name: string) {
    super(`Setlist "${name}" has no playable songs.`);
    this.name = 'EmptySetlistError';
  }
}

/**
 * A setlist entry references a library song that has since been deleted.
 * Reachable in normal use — library songs are deletable while referenced —
 * so this is a designed-for case, not corruption (design §8).
 */
export class MissingSongError extends Error {
  readonly code = 'missing_song';
  constructor(songId: string) {
    super(`Setlist references a missing song "${songId}".`);
    this.name = 'MissingSongError';
  }
}
