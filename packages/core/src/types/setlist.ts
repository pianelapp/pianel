import type {PerformanceSnapshot} from './performanceSnapshot';

export interface Scene {
  id: string;
  label: string;
  notes: string;
  snapshot: PerformanceSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface Song {
  id: string;
  name: string;
  notes: string;
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}

export interface SetlistEntry {
  songId: string;
  override: Song | null;
}

export interface Setlist {
  id: string;
  name: string;
  entries: SetlistEntry[];
  createdAt: string;
  updatedAt: string;
}

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

export class EntryNotFoundError extends Error {
  readonly code = 'entry_not_found';
  constructor(index: number) {
    super(`No entry at index ${index}.`);
    this.name = 'EntryNotFoundError';
  }
}

export class EmptySongError extends Error {
  readonly code = 'empty_song';
  constructor(name: string) {
    super(`Song "${name}" has no scenes to perform.`);
    this.name = 'EmptySongError';
  }
}

export class EmptySetlistError extends Error {
  readonly code = 'empty_setlist';
  constructor(name: string) {
    super(`Setlist "${name}" has no playable songs.`);
    this.name = 'EmptySetlistError';
  }
}

export class MissingSongError extends Error {
  readonly code = 'missing_song';
  constructor(songId: string) {
    super(`Setlist references a missing song "${songId}".`);
    this.name = 'MissingSongError';
  }
}
