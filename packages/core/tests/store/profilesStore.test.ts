/**
 * T005 — profilesStore unit tests.
 *
 * Covers:
 *  - create / update / rename / delete via the store actions.
 *  - `activeProfileId` invariant (FR-017) — setActiveProfileId switches it
 *    and persist round-trip preserves it.
 *  - MRU fallback on active-deletion is covered at the ProfileService level
 *    (T040); here we only verify that the store itself doesn't auto-pick a
 *    new active when one is removed.
 *  - Persist round-trip with `version: 1` via in-memory storage.
 */

import {inMemoryStorage} from '../../src/store/storage';
import {createProfilesStore} from '../../src/store/profilesStore';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../src/types/performanceSnapshot';
import type {Profile} from '../../src/types/profile';

function makeProfile(id: string, name: string): Profile {
  const now = new Date().toISOString();
  return {
    id,
    name,
    schemaVersion: 1,
    theme: 'system',
    accidentals: 'sharps',
    favorites: [],
    presets: [],
    defaultState: {...DEFAULT_PERFORMANCE_SNAPSHOT},
    createdAt: now,
    updatedAt: now,
  };
}

describe('profilesStore', () => {
  let store: ReturnType<typeof createProfilesStore>;

  beforeEach(async () => {
    // Clear in-memory storage to avoid cross-test bleed via the singleton.
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
    // activeProfileId is intentionally NOT auto-rebound here; ProfileService
    // owns the MRU fallback per data-model §2.
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

    // Zustand persist writes synchronously to our in-memory storage.
    const raw = await inMemoryStorage.getItem('pianel:profiles');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      state: {profiles: Profile[]; activeProfileId: string};
    };
    expect(parsed.state.profiles[0]?.id).toBe(a.id);
    expect(parsed.state.activeProfileId).toBe(a.id);
  });
});
