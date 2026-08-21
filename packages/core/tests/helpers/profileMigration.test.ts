import {normalizeProfile} from '../../src/helpers/profileMigration';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../src/types/performanceSnapshot';
import {CURRENT_SCHEMA_VERSION} from '../../src/types/schemaVersion';
import {OLDEST_SCHEMA_VERSION} from '../../src/helpers/schemaHistory';

function v1Profile() {
  return {
    id: '1-aaaaaaaa',
    name: 'Gig Day',
    schemaVersion: OLDEST_SCHEMA_VERSION,
    theme: 'dark',
    accidentals: 'flats',
    favorites: [{toneId: '0-0-0', sortOrder: 0}],
    presets: [],
    defaultState: {...DEFAULT_PERFORMANCE_SNAPSHOT},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('normalizeProfile', () => {
  it('adds empty songs and setlists to a v1 profile', () => {
    const out = normalizeProfile(v1Profile());
    expect(out.songs).toEqual([]);
    expect(out.setlists).toEqual([]);
  });

  it('bumps schemaVersion to 2', () => {
    const out = normalizeProfile(v1Profile());
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('preserves every existing v1 field', () => {
    const input = v1Profile();
    const out = normalizeProfile(input);
    expect(out.id).toBe('1-aaaaaaaa');
    expect(out.name).toBe('Gig Day');
    expect(out.theme).toBe('dark');
    expect(out.accidentals).toBe('flats');
    expect(out.favorites).toEqual([{toneId: '0-0-0', sortOrder: 0}]);
    expect(out.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('leaves an already-v2 profile untouched', () => {
    const song = {
      id: '2-bbbbbbbb',
      name: 'Superstition',
      scenes: [],
      createdAt: 'x',
      updatedAt: 'x',
    };
    const input = {...v1Profile(), schemaVersion: CURRENT_SCHEMA_VERSION, songs: [song], setlists: []};
    const out = normalizeProfile(input);
    expect(out.songs).toEqual([song]);
  });

  it('repairs a profile whose songs field is not an array', () => {
    const input = {...v1Profile(), songs: 'corrupt', setlists: null};
    const out = normalizeProfile(input);
    expect(out.songs).toEqual([]);
    expect(out.setlists).toEqual([]);
  });
});
