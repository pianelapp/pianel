import {inMemoryStorage} from '../../src/store/storage';
import {createProfilesStore} from '../../src/store/profilesStore';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../src/types/performanceSnapshot';
import {OLDEST_SCHEMA_VERSION} from '../../src/helpers/schemaHistory';
import {CURRENT_SCHEMA_VERSION} from '../../src/types/schemaVersion';

const KEY = 'pianel:profiles';

function storedProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: '1-aaaaaaaa',
    name: 'Old Gig',
    schemaVersion: OLDEST_SCHEMA_VERSION,
    theme: 'system',
    accidentals: 'sharps',
    favorites: [],
    presets: [],
    defaultState: {...DEFAULT_PERFORMANCE_SNAPSHOT},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function seed(payload: Record<string, unknown>) {
  await inMemoryStorage.setItem(KEY, JSON.stringify(payload));
}

async function readStored(): Promise<Record<string, unknown>> {
  return JSON.parse((await inMemoryStorage.getItem(KEY)) as string);
}

describe('profilesStore persist migration', () => {
  beforeEach(async () => {
    await inMemoryStorage.removeItem(KEY);
  });

  it('fills songs and setlists when rehydrating a payload with no version key', async () => {
    await seed({
      state: {profiles: [storedProfile()], activeProfileId: '1-aaaaaaaa'},
    });

    const store = createProfilesStore({storage: inMemoryStorage});
    await store.persist.rehydrate();

    const profile = store.getState().profiles[0];
    expect(profile.songs).toEqual([]);
    expect(profile.setlists).toEqual([]);
    expect(profile.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(store.getState().activeProfileId).toBe('1-aaaaaaaa');
  });

  it('normalizes a realistic version: 0 payload from an already-shipped build', async () => {
    await seed({
      state: {profiles: [storedProfile()], activeProfileId: '1-aaaaaaaa'},
      version: 0,
    });

    const store = createProfilesStore({storage: inMemoryStorage});
    await store.persist.rehydrate();

    const profile = store.getState().profiles[0];
    expect(profile.name).toBe('Old Gig');
    expect(profile.songs).toEqual([]);
    expect(profile.setlists).toEqual([]);
    expect(profile.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('stamps written payloads with version 0 so version-less builds can read them', async () => {
    const store = createProfilesStore({storage: inMemoryStorage});
    await store.persist.rehydrate();
    store.getState().setActiveProfileId('1-aaaaaaaa');

    expect((await readStored()).version).toBe(0);
  });

  it('rescues a payload stamped by a pre-fix build instead of discarding it', async () => {
    await seed({
      state: {
        profiles: [storedProfile({name: 'Pre-fix Gig'})],
        activeProfileId: '1-aaaaaaaa',
      },
      version: 2,
    });

    const store = createProfilesStore({storage: inMemoryStorage});
    await store.persist.rehydrate();

    expect(store.getState().profiles).toHaveLength(1);
    expect(store.getState().profiles[0].name).toBe('Pre-fix Gig');
    expect(store.getState().activeProfileId).toBe('1-aaaaaaaa');
  });

  it('heals a rescued payload back down to version 0 in storage', async () => {
    await seed({
      state: {profiles: [storedProfile()], activeProfileId: '1-aaaaaaaa'},
      version: 2,
    });

    const store = createProfilesStore({storage: inMemoryStorage});
    await store.persist.rehydrate();

    expect((await readStored()).version).toBe(0);
  });
});
