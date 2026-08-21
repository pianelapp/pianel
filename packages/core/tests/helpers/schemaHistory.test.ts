import {
  SCHEMA_HISTORY,
  OLDEST_SCHEMA_VERSION,
  MissingMigratorError,
  findSchemaVersionEntry,
  migrateToCurrent,
  type SchemaVersionEntry,
} from '../../src/helpers/schemaHistory';
import {normalizeProfile} from '../../src/helpers/profileMigration';
import {CURRENT_SCHEMA_VERSION} from '../../src/types/schemaVersion';

describe('schema history', () => {
  it('ends at the version this build emits', () => {
    expect(SCHEMA_HISTORY[SCHEMA_HISTORY.length - 1].version).toBe(
      CURRENT_SCHEMA_VERSION,
    );
  });

  it('starts at version 1', () => {
    expect(OLDEST_SCHEMA_VERSION).toBe(1);
  });

  it('ascends contiguously with no gaps or duplicates', () => {
    const versions = SCHEMA_HISTORY.map(entry => entry.version);
    expect(versions).toEqual(
      versions.map((_, index) => OLDEST_SCHEMA_VERSION + index),
    );
  });

  it('gives every version except the newest a migrator forward', () => {
    for (const entry of SCHEMA_HISTORY) {
      if (entry.version === CURRENT_SCHEMA_VERSION) {
        expect(entry.migrate).toBeUndefined();
      } else {
        expect(typeof entry.migrate).toBe('function');
      }
    }
  });

  it('describes what changed in every version after the first', () => {
    for (const entry of SCHEMA_HISTORY) {
      expect(entry.notes.trim()).not.toBe('');
      if (entry.version === OLDEST_SCHEMA_VERSION) continue;
      const diff = [
        ...(entry.added ?? []),
        ...(entry.removed ?? []),
        ...(entry.changed ?? []),
      ];
      expect(diff.length).toBeGreaterThan(0);
    }
  });

  it('reaches the current version from every version in the table', () => {
    for (const entry of SCHEMA_HISTORY) {
      const migrated = migrateToCurrent(
        {schemaVersion: entry.version, exportedAt: 'x', profile: {id: 'a', name: 'b'}},
        entry.version,
      );
      const expected =
        entry.version === CURRENT_SCHEMA_VERSION
          ? entry.version
          : CURRENT_SCHEMA_VERSION;
      expect(migrated.schemaVersion).toBe(expected);
    }
  });

  it('finds an entry by version and misses on an unknown one', () => {
    expect(findSchemaVersionEntry(OLDEST_SCHEMA_VERSION)?.version).toBe(
      OLDEST_SCHEMA_VERSION,
    );
    expect(findSchemaVersionEntry(CURRENT_SCHEMA_VERSION + 1)).toBeUndefined();
  });
});

describe('multi-hop migration chains', () => {
  const THREE_VERSIONS: SchemaVersionEntry[] = [
    {
      version: 1,
      notes: 'synthetic v1',
      migrate: file => ({...file, profile: normalizeProfile(file.profile)}),
    },
    {
      version: 2,
      notes: 'synthetic v2',
      added: ['profile.addedInV3'],
      migrate: file => ({
        ...file,
        profile: {...(file.profile as object), addedInV3: true},
      }),
    },
    {version: 3, notes: 'synthetic v3', added: ['nothing']},
  ];

  const v1File = () => ({
    schemaVersion: 1,
    exportedAt: '2026-01-01T00:00:00Z',
    profile: {id: '1234567890-abcdefgh', name: 'Chained'},
  });

  it('keeps the file and profile version markers in lockstep across hops', () => {
    const out = migrateToCurrent(v1File(), 1, THREE_VERSIONS, 3);
    expect(out.schemaVersion).toBe(3);
    expect((out.profile as {schemaVersion: number}).schemaVersion).toBe(3);
  });

  it('hands each migrator a profile stamped at its own input version', () => {
    const seen: number[] = [];
    const spied = THREE_VERSIONS.map(entry =>
      entry.version === 2
        ? {
            ...entry,
            migrate: (file: Record<string, unknown>) => {
              seen.push((file.profile as {schemaVersion: number}).schemaVersion);
              return entry.migrate!(file);
            },
          }
        : entry,
    );
    migrateToCurrent(v1File(), 1, spied, 3);
    expect(seen).toEqual([2]);
  });

  it('applies every intermediate hop, not just the last', () => {
    const out = migrateToCurrent(v1File(), 1, THREE_VERSIONS, 3);
    expect((out.profile as {addedInV3?: boolean}).addedInV3).toBe(true);
  });

  it('preserves untouched top-level fields through the chain', () => {
    const out = migrateToCurrent(v1File(), 1, THREE_VERSIONS, 3);
    expect(out.exportedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('throws MissingMigratorError when a hop has no migrator', () => {
    const gapped: SchemaVersionEntry[] = [
      {version: 1, notes: 'no way forward'},
      {version: 2, notes: 'unreachable'},
    ];
    expect(() => migrateToCurrent(v1File(), 1, gapped, 2)).toThrow(
      MissingMigratorError,
    );
  });

  it('is a no-op when the file is already at the target version', () => {
    const already = {schemaVersion: 3, profile: {id: 'x', name: 'y'}};
    expect(migrateToCurrent(already, 3, THREE_VERSIONS, 3)).toBe(already);
  });
});
