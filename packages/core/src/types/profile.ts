/**
 * Profile + Preset + export-file types (data-model.md §2/§3/§5/§6).
 *
 * All persisted shapes for the Profiles/Presets pivot live here. The previous
 * globally-scoped `presetsStore.Preset` shape is superseded by `Preset` below —
 * presets are now owned by a profile rather than persisted independently.
 */

import type {PerformanceSnapshot} from './performanceSnapshot';
import {CURRENT_SCHEMA_VERSION} from './setlist';
import type {Setlist, Song} from './setlist';

/** Fixed number of preset tiles per profile (Assumptions — *Preset tile count*). */
export const PRESET_TILE_COUNT = 8;

/**
 * Maximum supported `schemaVersion` for `ProfileExportFile` imports (R2, R8).
 * Mirrors `CURRENT_SCHEMA_VERSION` (types/setlist.ts) — the version this
 * build emits is by definition the newest version it will accept on import,
 * so the two must never drift apart. Re-exported here (rather than only from
 * setlist.ts) because it is validated as part of the Profile/export-file
 * shapes defined in this module.
 */
export const MAX_SUPPORTED_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

/** Lightweight favorite-tone reference embedded in a profile (data-model §5). */
export interface FavoriteRef {
  /** Tone id (e.g. "0-0-0" or "8-1-5"). */
  toneId: string;
  /** Display order within the profile's favorites list (0-based). */
  sortOrder: number;
}

/** Per-tile preset snapshot (data-model §3). */
export interface Preset {
  /** `<unix-ms>-<random>`. Unique within parent profile. */
  id: string;

  /** User-visible label (FR-008). Not enforced unique. */
  label: string;

  /** Fixed tile slot 0..7 (FR-004 + Assumptions — *Preset tile count*). */
  tilePosition: number;

  /** All captured parameter groups from FR-005. */
  snapshot: PerformanceSnapshot;

  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** Profile — the top-level workspace container (data-model §2). */
export interface Profile {
  /** `<unix-ms>-<random>`. Never mutates. Dedup key on import (FR-014). */
  id: string;

  /** User-visible label. Unique across local profile list at create/rename (R6). */
  name: string;

  /** Forward-compatibility marker. Always `2` for this release. */
  schemaVersion: 2;

  /** UI theme override. Mirrors `AppSettingsStore.themePreference`. */
  theme: 'system' | 'light' | 'dark';

  /** Sharp/flat preference for chord/pitch-class display. */
  accidentals: 'sharps' | 'flats';

  /** Favorites list — ordered tone references. Mirrors `FavoritesStore`. */
  favorites: FavoriteRef[];

  /** Per-tile preset grid (FR-009 — never global). */
  presets: Preset[];

  /** Reusable song library, scoped to this profile (design D6). */
  songs: Song[];

  /** Ordered gig setlists (design D6). */
  setlists: Setlist[];

  /** Default performance state applied on profile load (FR-011 §5). */
  defaultState: PerformanceSnapshot;

  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** Export-file shape (data-model §6, profile-export.schema.json). */
export interface ProfileExportFile {
  schemaVersion: 2;
  /** ISO 8601 timestamp produced at export time. */
  exportedAt: string;
  /** Exactly one profile per export (FR-018, R3). */
  profile: Profile;
}

// ─── Error subclasses (mirroring ProfileService.contract.ts) ────

export class DuplicateProfileNameError extends Error {
  readonly code = 'duplicate_profile_name';
  constructor(name: string) {
    super(`A profile named "${name}" already exists.`);
    this.name = 'DuplicateProfileNameError';
  }
}

export class ProfileNotFoundError extends Error {
  readonly code = 'profile_not_found';
  constructor(id: string) {
    super(`No profile with id "${id}".`);
    this.name = 'ProfileNotFoundError';
  }
}

export class MalformedProfileFileError extends Error {
  readonly code = 'malformed_profile_file';
  constructor(reason: string) {
    super(`Profile file is malformed: ${reason}`);
    this.name = 'MalformedProfileFileError';
  }
}

export class UnsupportedProfileVersionError extends Error {
  readonly code = 'unsupported_profile_version';
  constructor(version: number) {
    super(
      `Profile schemaVersion ${version} is newer than the supported maximum (${MAX_SUPPORTED_SCHEMA_VERSION}).`,
    );
    this.name = 'UnsupportedProfileVersionError';
  }
}

export class PresetGridFullError extends Error {
  readonly code = 'preset_grid_full';
  constructor(tilePosition: number) {
    super(`Tile ${tilePosition} is already occupied.`);
    this.name = 'PresetGridFullError';
  }
}
