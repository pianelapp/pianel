import {normalizeProfile} from './profileMigration';
import {CURRENT_SCHEMA_VERSION} from '../types/schemaVersion';

export interface SchemaVersionEntry {
  version: number;
  notes: string;
  added?: readonly string[];
  removed?: readonly string[];
  changed?: readonly string[];
  migrate?: (file: Record<string, unknown>) => Record<string, unknown>;
}

export const SCHEMA_HISTORY: readonly SchemaVersionEntry[] = [
  {
    version: 1,
    notes: 'Initial profile shape: presets, favorites, defaultState.',
    migrate: file => ({...file, profile: normalizeProfile(file.profile)}),
  },
  {
    version: 2,
    notes: 'Songs/setlists pivot — reusable song library plus ordered gig setlists.',
    added: ['profile.songs', 'profile.setlists'],
    migrate: file => file,
  },
  {
    version: 3,
    notes:
      'Key touch capture — snapshots remember the velocity curve. Additive and optional: a v2 snapshot simply omits it, and apply then leaves the piano\'s own curve alone.',
    added: [
      'profile.defaultState.keyTouch',
      'profile.presets[].snapshot.keyTouch',
      'profile.songs[].scenes[].snapshot.keyTouch',
      'profile.setlists[].entries[].override.scenes[].snapshot.keyTouch',
    ],
  },
];

export const OLDEST_SCHEMA_VERSION = SCHEMA_HISTORY[0].version;

export class MissingMigratorError extends Error {
  readonly code = 'missing_migrator';
  constructor(version: number) {
    super(`no migrator for schemaVersion ${version}`);
    this.name = 'MissingMigratorError';
  }
}

export function findSchemaVersionEntry(
  version: number,
): SchemaVersionEntry | undefined {
  return SCHEMA_HISTORY.find(entry => entry.version === version);
}

function stampVersion(
  file: Record<string, unknown>,
  version: number,
): Record<string, unknown> {
  const profile = file.profile;
  const stamped: Record<string, unknown> = {...file, schemaVersion: version};
  if (profile && typeof profile === 'object') {
    stamped.profile = {
      ...(profile as Record<string, unknown>),
      schemaVersion: version,
    };
  }
  return stamped;
}

export function migrateToCurrent(
  file: Record<string, unknown>,
  fromVersion: number,
  history: readonly SchemaVersionEntry[] = SCHEMA_HISTORY,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
): Record<string, unknown> {
  let candidate = file;
  for (let version = fromVersion; version < targetVersion; version++) {
    const entry = history.find(item => item.version === version);
    if (!entry?.migrate) {
      throw new MissingMigratorError(version);
    }
    candidate = stampVersion(entry.migrate(candidate), version + 1);
  }
  return candidate;
}
