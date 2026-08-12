/**
 * SetlistService — setlist CRUD, entry ordering and per-gig overrides.
 *
 * An entry is a reference to a library song plus an optional full copy-on-write
 * override (design D3). `resolveEntry` is the single place that decides which
 * of the two a caller sees, and returns null for a dangling reference — a
 * normal, reachable state because library songs are deletable while referenced.
 */

import {requireActiveProfile, writeActiveProfile} from '../activeProfile';
import {generateProfileId} from '../../helpers/profileId';
import {SetlistNotFoundError, SongNotFoundError} from '../../types/setlist';
import type {Setlist, Song} from '../../types/setlist';
import type {SongService} from '../songs/SongService';

export class SetlistService {
  private songService: SongService;

  constructor(songService: SongService) {
    this.songService = songService;
  }

  // ─── Setlists ────────────────────────────────────────────────

  listSetlists(): Setlist[] {
    return requireActiveProfile().setlists;
  }

  getSetlist(setlistId: string): Setlist | null {
    return requireActiveProfile().setlists.find(s => s.id === setlistId) ?? null;
  }

  createSetlist(name: string): Setlist {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Setlist name cannot be empty.');

    const now = new Date().toISOString();
    const setlist: Setlist = {
      id: generateProfileId(),
      name: trimmed,
      entries: [],
      createdAt: now,
      updatedAt: now,
    };

    writeActiveProfile(profile => ({
      ...profile,
      setlists: [...profile.setlists, setlist],
    }));
    return setlist;
  }

  renameSetlist(setlistId: string, name: string): Setlist {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Setlist name cannot be empty.');
    return this._patchSetlist(setlistId, list => ({...list, name: trimmed}));
  }

  deleteSetlist(setlistId: string): void {
    if (!this.getSetlist(setlistId)) throw new SetlistNotFoundError(setlistId);
    writeActiveProfile(profile => ({
      ...profile,
      setlists: profile.setlists.filter(s => s.id !== setlistId),
    }));
  }

  // ─── Entries ─────────────────────────────────────────────────

  addSong(setlistId: string, songId: string): Setlist {
    if (!this.songService.getSong(songId)) throw new SongNotFoundError(songId);
    return this._patchSetlist(setlistId, list => ({
      ...list,
      entries: [...list.entries, {songId, override: null}],
    }));
  }

  removeEntry(setlistId: string, entryIndex: number): Setlist {
    return this._patchSetlist(setlistId, list => ({
      ...list,
      entries: list.entries.filter((_, i) => i !== entryIndex),
    }));
  }

  /** Reorder by array position (design D2). Indices are clamped. */
  moveEntry(setlistId: string, from: number, to: number): Setlist {
    const list = this.getSetlist(setlistId);
    if (!list) throw new SetlistNotFoundError(setlistId);

    const last = list.entries.length - 1;
    const src = Math.max(0, Math.min(last, from));
    const dest = Math.max(0, Math.min(last, to));
    if (src === dest) return list;

    const entries = [...list.entries];
    const [moved] = entries.splice(src, 1);
    entries.splice(dest, 0, moved);
    return this._patchSetlist(setlistId, l => ({...l, entries}));
  }

  /**
   * The song a given entry actually performs: its override when customized,
   * otherwise the library song. `null` means the reference is dangling.
   */
  resolveEntry(setlistId: string, entryIndex: number): Song | null {
    const list = this.getSetlist(setlistId);
    if (!list) return null;
    const entry = list.entries[entryIndex];
    if (!entry) return null;
    return entry.override ?? this.songService.getSong(entry.songId);
  }

  // ─── Overrides (design D3 — full copy, never a patch) ────────

  /** True when this entry carries a gig-specific clone. */
  isCustomized(setlistId: string, entryIndex: number): boolean {
    const list = this.getSetlist(setlistId);
    return Boolean(list?.entries[entryIndex]?.override);
  }

  /**
   * Detach this entry from the library: clone the whole song into the entry.
   * Idempotent — calling it on an already-customized entry returns the
   * existing clone rather than re-cloning.
   */
  customizeEntry(setlistId: string, entryIndex: number): Song {
    const list = this.getSetlist(setlistId);
    if (!list) throw new SetlistNotFoundError(setlistId);
    const entry = list.entries[entryIndex];
    if (!entry) throw new Error(`No entry at index ${entryIndex}.`);
    if (entry.override) return entry.override;

    const source = this.songService.getSong(entry.songId);
    if (!source) throw new SongNotFoundError(entry.songId);

    const clone: Song = {
      ...(JSON.parse(JSON.stringify(source)) as Song),
      id: generateProfileId(),
      updatedAt: new Date().toISOString(),
    };

    this._patchSetlist(setlistId, l => ({
      ...l,
      entries: l.entries.map((e, i) => (i === entryIndex ? {...e, override: clone} : e)),
    }));
    return clone;
  }

  /** Discard the override; the entry follows the library song again. */
  revertEntry(setlistId: string, entryIndex: number): Setlist {
    const list = this.getSetlist(setlistId);
    if (!list) throw new SetlistNotFoundError(setlistId);
    if (!list.entries[entryIndex]) throw new Error(`No entry at index ${entryIndex}.`);

    return this._patchSetlist(setlistId, l => ({
      ...l,
      entries: l.entries.map((e, i) => (i === entryIndex ? {...e, override: null} : e)),
    }));
  }

  /**
   * Push the override's content back onto the library song (keeping the
   * library id) and clear the override.
   */
  promoteEntry(setlistId: string, entryIndex: number): Song {
    const list = this.getSetlist(setlistId);
    if (!list) throw new SetlistNotFoundError(setlistId);
    const entry = list.entries[entryIndex];
    if (!entry) throw new Error(`No entry at index ${entryIndex}.`);
    if (!entry.override) throw new Error(`Entry ${entryIndex} is not customized.`);

    const target = this.songService.getSong(entry.songId);
    if (!target) throw new SongNotFoundError(entry.songId);

    const merged: Song = {
      ...(JSON.parse(JSON.stringify(entry.override)) as Song),
      id: target.id,
      createdAt: target.createdAt,
      updatedAt: new Date().toISOString(),
    };

    writeActiveProfile(profile => ({
      ...profile,
      songs: profile.songs.map(s => (s.id === target.id ? merged : s)),
    }));
    this.revertEntry(setlistId, entryIndex);
    return merged;
  }

  /**
   * Apply a pure Song transform to a customized entry's override.
   *
   * This is the only supported way to edit a detached gig version. Compose it
   * with the transforms in helpers/songEdits.ts, e.g.
   *   editOverride(id, 0, song => moveSceneInSong(song, 2, 0))
   */
  editOverride(
    setlistId: string,
    entryIndex: number,
    transform: (song: Song) => Song,
  ): Song {
    const list = this.getSetlist(setlistId);
    if (!list) throw new SetlistNotFoundError(setlistId);
    const entry = list.entries[entryIndex];
    if (!entry) throw new Error(`No entry at index ${entryIndex}.`);
    if (!entry.override) throw new Error(`Entry ${entryIndex} is not customized.`);

    const next: Song = {
      ...transform(entry.override),
      updatedAt: new Date().toISOString(),
    };

    this._patchSetlist(setlistId, l => ({
      ...l,
      entries: l.entries.map((e, i) =>
        i === entryIndex ? {...e, override: next} : e,
      ),
    }));
    return next;
  }

  /** How many setlist entries still follow this library song. */
  countSetlistsUsing(songId: string): number {
    return requireActiveProfile().setlists.reduce(
      (count, list) =>
        count +
        list.entries.filter(e => e.songId === songId && !e.override).length,
      0,
    );
  }

  // ─── Internals ───────────────────────────────────────────────

  protected _patchSetlist(
    setlistId: string,
    patch: (list: Setlist) => Setlist,
  ): Setlist {
    const existing = this.getSetlist(setlistId);
    if (!existing) throw new SetlistNotFoundError(setlistId);

    const next: Setlist = {...patch(existing), updatedAt: new Date().toISOString()};
    writeActiveProfile(profile => ({
      ...profile,
      setlists: profile.setlists.map(s => (s.id === setlistId ? next : s)),
    }));
    return next;
  }
}
