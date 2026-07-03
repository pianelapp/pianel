/**
 * T051: Favorites Zustand Store (v2 rewrite).
 *
 * Persists user's favorite tones in MMKV with FavoriteTone data model.
 * Supports mixed SN + GM2 tones in the same list.
 * Actions: addFavorite, removeFavorite, isFavorite, reorder, getFavorites.
 *
 * Constitution I: Offline-First — all data stored locally, no network calls.
 */

import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import type {StateStorage} from './storage';

/** A saved favorite tone reference with metadata. */
export interface FavoriteTone {
  /** Tone.id reference (e.g. "0-0-0" or "8-1-5") */
  toneId: string;
  /** ISO 8601 timestamp when added */
  addedAt: string;
  /** Display order (0-based, contiguous) */
  sortOrder: number;
}

export interface FavoritesState {
  /** Array of favorite tone entries, ordered by sortOrder */
  favorites: FavoriteTone[];
}

export interface FavoritesActions {
  /** Add a tone to favorites. Prevents duplicates. Auto-assigns sortOrder. */
  addFavorite: (toneId: string) => void;
  /** Remove a tone from favorites. Re-indexes sortOrder. */
  removeFavorite: (toneId: string) => void;
  /** Check if a tone is in favorites. */
  isFavorite: (toneId: string) => boolean;
  /** Reorder favorites by providing the new ID sequence. */
  reorder: (orderedIds: string[]) => void;
  /** Get all favorites sorted by sortOrder. */
  getFavorites: () => FavoriteTone[];
}

type StoreType = ReturnType<typeof _build>;
let _store: StoreType | null = null;

function _build(storage: StateStorage) {
  return create<FavoritesState & FavoritesActions>()(
    persist(
      (set, get) => ({
        favorites: [],

        addFavorite: (toneId: string) =>
          set((state) => {
            if (state.favorites.some((f) => f.toneId === toneId)) return state;
            return {
              favorites: [
                ...state.favorites,
                {toneId, addedAt: new Date().toISOString(), sortOrder: state.favorites.length},
              ],
            };
          }),

        removeFavorite: (toneId: string) =>
          set((state) => ({
            favorites: state.favorites
              .filter((f) => f.toneId !== toneId)
              .map((f, i) => ({...f, sortOrder: i})),
          })),

        isFavorite: (toneId: string) =>
          get().favorites.some((f) => f.toneId === toneId),

        reorder: (orderedIds: string[]) =>
          set((state) => {
            const map = new Map(state.favorites.map((f) => [f.toneId, f]));
            const reordered: FavoriteTone[] = [];
            for (let i = 0; i < orderedIds.length; i++) {
              const existing = map.get(orderedIds[i]);
              if (existing) reordered.push({...existing, sortOrder: i});
            }
            return {favorites: reordered};
          }),

        getFavorites: () =>
          [...get().favorites].sort((a, b) => a.sortOrder - b.sortOrder),
      }),
      {name: 'pianel:favorites', storage: createJSONStorage(() => storage)},
    ),
  );
}

function _get(): StoreType {
  if (!_store) throw new Error('favoritesStore not initialized');
  return _store;
}

const _proxy = ((...args: Parameters<StoreType>) => _get()(...args)) as StoreType;
_proxy.getState = () => _get().getState();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
_proxy.setState = (state: any, replace?: any) => _get().setState(state, replace);
_proxy.subscribe = (...args: Parameters<StoreType['subscribe']>) => _get().subscribe(...args);
_proxy.getInitialState = () => _get().getInitialState();

export const useFavoritesStore = _proxy;

export function createFavoritesStore({storage}: {storage: StateStorage}) {
  _store = _build(storage);
  return useFavoritesStore;
}
