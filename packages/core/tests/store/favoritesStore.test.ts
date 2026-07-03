/**
 * T052: Favorites store tests.
 *
 * Verifies add/remove/duplicate prevention, sortOrder re-indexing,
 * isFavorite, reorder, mixed SN+GM2 tones, and persistence shape.
 */

import {useFavoritesStore, createFavoritesStore} from '../../src/store/favoritesStore';
import {inMemoryStorage} from '../../src/store/storage';

beforeAll(() => {
  createFavoritesStore({storage: inMemoryStorage});
});

// SN tone IDs
const concertPianoId = '0-0-0'; // SN Piano, category 0
const epicStringsId = '3-0-0'; // SN Strings, category 3
const superSawId = '5-0-0'; // SN Synth, category 5

// GM2 tone IDs
const gm2Piano1Id = '8-0-0'; // GM2, position 0
const gm2ViolinId = '8-0-93'; // GM2, position 93

beforeEach(() => {
  useFavoritesStore.setState({favorites: []});
});

describe('favoritesStore', () => {
  describe('initial state', () => {
    it('has empty favorites', () => {
      expect(useFavoritesStore.getState().favorites).toHaveLength(0);
    });
  });

  describe('addFavorite', () => {
    it('adds a favorite with addedAt timestamp and sortOrder', () => {
      const before = new Date().toISOString();
      useFavoritesStore.getState().addFavorite(concertPianoId);
      const after = new Date().toISOString();

      const favorites = useFavoritesStore.getState().favorites;
      expect(favorites).toHaveLength(1);
      expect(favorites[0].toneId).toBe(concertPianoId);
      expect(favorites[0].sortOrder).toBe(0);
      // addedAt should be a valid ISO 8601 string between before and after
      expect(favorites[0].addedAt >= before).toBe(true);
      expect(favorites[0].addedAt <= after).toBe(true);
    });

    it('auto-increments sortOrder for subsequent adds', () => {
      useFavoritesStore.getState().addFavorite(concertPianoId);
      useFavoritesStore.getState().addFavorite(epicStringsId);
      useFavoritesStore.getState().addFavorite(superSawId);

      const favorites = useFavoritesStore.getState().favorites;
      expect(favorites).toHaveLength(3);
      expect(favorites[0].sortOrder).toBe(0);
      expect(favorites[1].sortOrder).toBe(1);
      expect(favorites[2].sortOrder).toBe(2);
    });

    it('prevents duplicate entries', () => {
      useFavoritesStore.getState().addFavorite(concertPianoId);
      useFavoritesStore.getState().addFavorite(concertPianoId);

      const favorites = useFavoritesStore.getState().favorites;
      expect(favorites).toHaveLength(1);
    });
  });

  describe('removeFavorite', () => {
    it('removes a favorite by toneId', () => {
      useFavoritesStore.getState().addFavorite(concertPianoId);
      useFavoritesStore.getState().addFavorite(epicStringsId);
      useFavoritesStore.getState().removeFavorite(concertPianoId);

      const favorites = useFavoritesStore.getState().favorites;
      expect(favorites).toHaveLength(1);
      expect(favorites[0].toneId).toBe(epicStringsId);
    });

    it('re-indexes sortOrder after removal', () => {
      useFavoritesStore.getState().addFavorite(concertPianoId);
      useFavoritesStore.getState().addFavorite(epicStringsId);
      useFavoritesStore.getState().addFavorite(superSawId);

      // Remove middle item
      useFavoritesStore.getState().removeFavorite(epicStringsId);

      const favorites = useFavoritesStore.getState().favorites;
      expect(favorites).toHaveLength(2);
      expect(favorites[0].toneId).toBe(concertPianoId);
      expect(favorites[0].sortOrder).toBe(0);
      expect(favorites[1].toneId).toBe(superSawId);
      expect(favorites[1].sortOrder).toBe(1);
    });

    it('is a no-op for non-existent toneId', () => {
      useFavoritesStore.getState().addFavorite(concertPianoId);
      useFavoritesStore.getState().removeFavorite('nonexistent');

      expect(useFavoritesStore.getState().favorites).toHaveLength(1);
    });
  });

  describe('isFavorite', () => {
    it('returns true for favorited tone', () => {
      useFavoritesStore.getState().addFavorite(concertPianoId);
      expect(useFavoritesStore.getState().isFavorite(concertPianoId)).toBe(true);
    });

    it('returns false for non-favorited tone', () => {
      expect(useFavoritesStore.getState().isFavorite(concertPianoId)).toBe(
        false,
      );
    });

    it('returns false after removal', () => {
      useFavoritesStore.getState().addFavorite(concertPianoId);
      useFavoritesStore.getState().removeFavorite(concertPianoId);
      expect(useFavoritesStore.getState().isFavorite(concertPianoId)).toBe(
        false,
      );
    });
  });

  describe('reorder', () => {
    it('reorders favorites by provided ID sequence', () => {
      useFavoritesStore.getState().addFavorite(concertPianoId);
      useFavoritesStore.getState().addFavorite(epicStringsId);
      useFavoritesStore.getState().addFavorite(superSawId);

      // Reverse the order
      useFavoritesStore
        .getState()
        .reorder([superSawId, epicStringsId, concertPianoId]);

      const favorites = useFavoritesStore.getState().favorites;
      expect(favorites).toHaveLength(3);
      expect(favorites[0].toneId).toBe(superSawId);
      expect(favorites[0].sortOrder).toBe(0);
      expect(favorites[1].toneId).toBe(epicStringsId);
      expect(favorites[1].sortOrder).toBe(1);
      expect(favorites[2].toneId).toBe(concertPianoId);
      expect(favorites[2].sortOrder).toBe(2);
    });

    it('drops IDs not in the current favorites', () => {
      useFavoritesStore.getState().addFavorite(concertPianoId);
      useFavoritesStore.getState().addFavorite(epicStringsId);

      useFavoritesStore
        .getState()
        .reorder([epicStringsId, 'nonexistent', concertPianoId]);

      const favorites = useFavoritesStore.getState().favorites;
      expect(favorites).toHaveLength(2);
      expect(favorites[0].toneId).toBe(epicStringsId);
      expect(favorites[1].toneId).toBe(concertPianoId);
    });
  });

  describe('getFavorites', () => {
    it('returns favorites sorted by sortOrder', () => {
      useFavoritesStore.getState().addFavorite(concertPianoId);
      useFavoritesStore.getState().addFavorite(epicStringsId);
      useFavoritesStore.getState().addFavorite(superSawId);

      const sorted = useFavoritesStore.getState().getFavorites();
      expect(sorted.map((f) => f.toneId)).toEqual([
        concertPianoId,
        epicStringsId,
        superSawId,
      ]);
    });
  });

  describe('mixed SN + GM2 tones', () => {
    it('supports both SN and GM2 tone IDs in the same list', () => {
      useFavoritesStore.getState().addFavorite(concertPianoId); // SN
      useFavoritesStore.getState().addFavorite(gm2Piano1Id); // GM2
      useFavoritesStore.getState().addFavorite(epicStringsId); // SN
      useFavoritesStore.getState().addFavorite(gm2ViolinId); // GM2

      const favorites = useFavoritesStore.getState().favorites;
      expect(favorites).toHaveLength(4);

      const ids = favorites.map((f) => f.toneId);
      expect(ids).toContain(concertPianoId);
      expect(ids).toContain(gm2Piano1Id);
      expect(ids).toContain(epicStringsId);
      expect(ids).toContain(gm2ViolinId);
    });

    it('isFavorite works for both SN and GM2', () => {
      useFavoritesStore.getState().addFavorite(concertPianoId); // SN
      useFavoritesStore.getState().addFavorite(gm2Piano1Id); // GM2

      expect(useFavoritesStore.getState().isFavorite(concertPianoId)).toBe(
        true,
      );
      expect(useFavoritesStore.getState().isFavorite(gm2Piano1Id)).toBe(true);
      expect(useFavoritesStore.getState().isFavorite(gm2ViolinId)).toBe(false);
    });
  });

  describe('persistence shape', () => {
    it('stores favorites array with correct structure', () => {
      useFavoritesStore.getState().addFavorite(concertPianoId);

      const state = useFavoritesStore.getState();
      expect(state.favorites).toEqual([
        expect.objectContaining({
          toneId: concertPianoId,
          sortOrder: 0,
          addedAt: expect.any(String),
        }),
      ]);

      // Validate ISO 8601 format
      const parsed = new Date(state.favorites[0].addedAt);
      expect(parsed.toISOString()).toBe(state.favorites[0].addedAt);
    });
  });
});
