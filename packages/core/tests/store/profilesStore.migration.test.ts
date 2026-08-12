import {inMemoryStorage} from '../../src/store/storage';
import {createProfilesStore} from '../../src/store/profilesStore';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../src/types/performanceSnapshot';

describe('profilesStore persist migration', () => {
  beforeEach(async () => {
    await inMemoryStorage.removeItem('pianel:profiles');
  });

  it('fills songs and setlists when rehydrating a pre-v2 payload', async () => {
    // A payload written by an older build: no `version` key, no songs/setlists.
    await inMemoryStorage.setItem(
      'pianel:profiles',
      JSON.stringify({
        state: {
          profiles: [
            {
              id: '1-aaaaaaaa',
              name: 'Old Gig',
              schemaVersion: 1,
              theme: 'system',
              accidentals: 'sharps',
              favorites: [],
              presets: [],
              defaultState: {...DEFAULT_PERFORMANCE_SNAPSHOT},
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          activeProfileId: '1-aaaaaaaa',
        },
      }),
    );

    const store = createProfilesStore({storage: inMemoryStorage});
    await store.persist.rehydrate();

    const profile = store.getState().profiles[0];
    expect(profile.songs).toEqual([]);
    expect(profile.setlists).toEqual([]);
    expect(profile.schemaVersion).toBe(2);
    expect(store.getState().activeProfileId).toBe('1-aaaaaaaa');
  });
});
