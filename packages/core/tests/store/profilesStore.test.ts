import {inMemoryStorage} from '../../src/store/storage';
import {createProfilesStore} from '../../src/store/profilesStore';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../src/types/performanceSnapshot';
import type {Profile} from '../../src/types/profile';
import {CURRENT_SCHEMA_VERSION} from '../../src/types/schemaVersion';

function makeProfile(id: string, name: string): Profile {
  const now = new Date().toISOString();
  return {
    id,
    name,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: 'system',
    accidentals: 'sharps',
    favorites: [],
    presets: [],
    songs: [],
    setlists: [],
    defaultState: {...DEFAULT_PERFORMANCE_SNAPSHOT},
    createdAt: now,
    updatedAt: now,
  };
}

describe('profilesStore', () => {
  let store: ReturnType<typeof createProfilesStore>;

  beforeEach(async () => {
    await inMemoryStorage.removeItem('pianel:profiles');
    store = createProfilesStore({storage: inMemoryStorage});
  });

  it('starts with empty profiles and no active id', () => {
    expect(store.getState().profiles).toEqual([]);
    expect(store.getState().activeProfileId).toBe('');
  });

  it('addProfile appends without changing activeProfileId', () => {
    const p = makeProfile('1-aaaaaaaa', 'Alpha');
    store.getState().addProfile(p);
    expect(store.getState().profiles).toHaveLength(1);
    expect(store.getState().profiles[0]).toBe(p);
    expect(store.getState().activeProfileId).toBe('');
  });

  it('updateProfileInList replaces by id', () => {
    const a = makeProfile('1-aaaaaaaa', 'Alpha');
    const b = makeProfile('2-bbbbbbbb', 'Beta');
    store.getState().addProfile(a);
    store.getState().addProfile(b);

    const updated: Profile = {...a, theme: 'dark'};
    store.getState().updateProfileInList(updated);

    const got = store.getState().profiles.find(p => p.id === a.id);
    expect(got?.theme).toBe('dark');
    expect(store.getState().profiles).toHaveLength(2);
  });

  it('renameProfileInList changes only name + updatedAt', () => {
    const a = makeProfile('1-aaaaaaaa', 'Alpha');
    store.getState().addProfile(a);
    store.getState().renameProfileInList(a.id, 'Renamed');

    const got = store.getState().profiles[0];
    expect(got.name).toBe('Renamed');
    expect(got.theme).toBe(a.theme);
    expect(got.updatedAt >= a.updatedAt).toBe(true);
  });

  it('removeProfile drops by id without touching activeProfileId', () => {
    const a = makeProfile('1-aaaaaaaa', 'Alpha');
    const b = makeProfile('2-bbbbbbbb', 'Beta');
    store.getState().addProfile(a);
    store.getState().addProfile(b);
    store.getState().setActiveProfileId(a.id);
    store.getState().removeProfile(a.id);

    expect(store.getState().profiles.map(p => p.id)).toEqual([b.id]);
    expect(store.getState().activeProfileId).toBe(a.id);
  });

  it('setActiveProfileId enforces the FR-017 invariant', () => {
    const a = makeProfile('1-aaaaaaaa', 'Alpha');
    store.getState().addProfile(a);
    store.getState().setActiveProfileId(a.id);
    expect(store.getState().activeProfileId).toBe(a.id);
  });

  it('replaceProfileById replaces an existing id in place', () => {
    const a = makeProfile('1-aaaaaaaa', 'Alpha');
    store.getState().addProfile(a);
    const replacement: Profile = {...a, name: 'Alpha (Imported)'};
    store.getState().replaceProfileById(replacement);
    expect(store.getState().profiles).toHaveLength(1);
    expect(store.getState().profiles[0].name).toBe('Alpha (Imported)');
  });

  it('replaceProfileById appends when id is new', () => {
    const a = makeProfile('1-aaaaaaaa', 'Alpha');
    store.getState().replaceProfileById(a);
    expect(store.getState().profiles).toEqual([a]);
  });

  it('persists profile list + active id via the storage adapter', async () => {
    const a = makeProfile('1-aaaaaaaa', 'Alpha');
    store.getState().addProfile(a);
    store.getState().setActiveProfileId(a.id);

    const raw = await inMemoryStorage.getItem('pianel:profiles');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      state: {profiles: Profile[]; activeProfileId: string};
    };
    expect(parsed.state.profiles[0]?.id).toBe(a.id);
    expect(parsed.state.activeProfileId).toBe(a.id);
  });
});
