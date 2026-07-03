import { useCallback, useMemo } from 'react';
import { useConnectionStore, useFavoritesStore } from '../store';
import { getPianoService } from './usePiano';
import { getProfileService } from './useProfiles';
import type { Tone } from '@pianel/core/types/types';

export function useFavorites() {
  const favorites = useFavoritesStore(s => s.favorites);
  const addFavorite = useFavoritesStore(s => s.addFavorite);
  const removeFavorite = useFavoritesStore(s => s.removeFavorite);
  const isFavoriteInStore = useFavoritesStore(s => s.isFavorite);
  // `getToneCatalog()` is null until the piano connects and the engine is
  // wired up. We track the connection status so the memo re-resolves once
  // the catalog becomes available — otherwise a boot-time `loadProfile`
  // populates `favorites` but the sidebar stays empty until the next
  // favorites mutation.
  const connectionStatus = useConnectionStore(s => s.status);

  const resolvedFavorites: Tone[] = useMemo(() => {
    const catalog = getPianoService()?.getToneCatalog();
    if (!catalog) return [];
    const sorted = [...favorites].sort((a, b) => a.sortOrder - b.sortOrder);
    const resolved: Tone[] = [];
    for (const fav of sorted) {
      const tone = catalog.findById(fav.toneId);
      if (tone) resolved.push(tone);
    }
    return resolved;
  }, [favorites, connectionStatus]);

  const toggleFavorite = useCallback(
    (toneId: string) => {
      if (isFavoriteInStore(toneId)) {
        removeFavorite(toneId);
      } else {
        addFavorite(toneId);
      }
      // Mirror into the active profile so the on-disk source of truth stays
      // in sync (data-model §5 — `Profile.favorites` is the persisted copy).
      getProfileService()?.syncActiveFavorites();
    },
    [isFavoriteInStore, addFavorite, removeFavorite],
  );

  const isFavorite = useCallback(
    (toneId: string): boolean => isFavoriteInStore(toneId),
    [isFavoriteInStore],
  );

  return { favorites: resolvedFavorites, toggleFavorite, isFavorite };
}
