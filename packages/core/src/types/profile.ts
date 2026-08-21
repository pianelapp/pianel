import type {PerformanceSnapshot} from './performanceSnapshot';
import {CURRENT_SCHEMA_VERSION} from './schemaVersion';
import type {SchemaVersion} from './schemaVersion';
import type {Setlist, Song} from './setlist';

export const PRESET_TILE_COUNT = 8;

export interface FavoriteRef {
  toneId: string;
  sortOrder: number;
}

export interface Preset {
  id: string;

  label: string;

  tilePosition: number;

  snapshot: PerformanceSnapshot;

  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;

  name: string;

  schemaVersion: SchemaVersion;

  theme: 'system' | 'light' | 'dark';

  accidentals: 'sharps' | 'flats';

  favorites: FavoriteRef[];

  presets: Preset[];

  songs: Song[];

  setlists: Setlist[];

  defaultState: PerformanceSnapshot;

  createdAt: string;
  updatedAt: string;
}

export interface ProfileExportFile {
  schemaVersion: SchemaVersion;
  exportedAt: string;
  profile: Profile;
}

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
      `Profile schemaVersion ${version} is newer than the supported maximum (${CURRENT_SCHEMA_VERSION}).`,
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
