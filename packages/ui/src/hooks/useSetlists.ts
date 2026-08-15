import { useCallback, useMemo } from 'react';
import { useProfilesStore, selectActiveProfile } from '../store';
import type { Setlist, Song } from '../store';
import type { SetlistService } from '@pianel/core/services/setlists/SetlistService';

let setlistServiceInstance: SetlistService | null = null;

export function setSetlistService(service: SetlistService): void {
  setlistServiceInstance = service;
}

export function getSetlistService(): SetlistService | null {
  return setlistServiceInstance;
}

export function resetSetlistService(): void {
  setlistServiceInstance = null;
}

const EMPTY: Setlist[] = [];

export function useSetlists() {
  const activeProfile = useProfilesStore(selectActiveProfile);
  const setlists = useMemo(() => activeProfile?.setlists ?? EMPTY, [activeProfile]);

  const createSetlist = useCallback((name: string): Setlist | null => {
    return getSetlistService()?.createSetlist(name) ?? null;
  }, []);

  const renameSetlist = useCallback((setlistId: string, name: string): void => {
    getSetlistService()?.renameSetlist(setlistId, name);
  }, []);

  const deleteSetlist = useCallback((setlistId: string): void => {
    getSetlistService()?.deleteSetlist(setlistId);
  }, []);

  const addSong = useCallback((setlistId: string, songId: string): void => {
    getSetlistService()?.addSong(setlistId, songId);
  }, []);

  const removeEntry = useCallback((setlistId: string, entryIndex: number): void => {
    getSetlistService()?.removeEntry(setlistId, entryIndex);
  }, []);

  const moveEntry = useCallback(
    (setlistId: string, from: number, to: number): void => {
      getSetlistService()?.moveEntry(setlistId, from, to);
    },
    [],
  );

  const resolveEntry = useCallback(
    (setlistId: string, entryIndex: number): Song | null =>
      getSetlistService()?.resolveEntry(setlistId, entryIndex) ?? null,
    [],
  );

  const isCustomized = useCallback(
    (setlistId: string, entryIndex: number): boolean =>
      getSetlistService()?.isCustomized(setlistId, entryIndex) ?? false,
    [],
  );

  const customizeEntry = useCallback((setlistId: string, entryIndex: number): void => {
    getSetlistService()?.customizeEntry(setlistId, entryIndex);
  }, []);

  const revertEntry = useCallback((setlistId: string, entryIndex: number): void => {
    getSetlistService()?.revertEntry(setlistId, entryIndex);
  }, []);

  const promoteEntry = useCallback((setlistId: string, entryIndex: number): void => {
    getSetlistService()?.promoteEntry(setlistId, entryIndex);
  }, []);

  const editOverride = useCallback(
    (setlistId: string, entryIndex: number, transform: (song: Song) => Song): void => {
      getSetlistService()?.editOverride(setlistId, entryIndex, transform);
    },
    [],
  );

  const countSetlistsUsing = useCallback(
    (songId: string): number =>
      getSetlistService()?.countSetlistsUsing(songId) ?? 0,
    [],
  );

  const findLibraryUses = useCallback(
    (songId: string): Array<{setlistId: string; entryIndex: number}> =>
      getSetlistService()?.findLibraryUses(songId) ?? [],
    [],
  );

  return {
    setlists,
    createSetlist,
    renameSetlist,
    deleteSetlist,
    addSong,
    removeEntry,
    moveEntry,
    resolveEntry,
    isCustomized,
    customizeEntry,
    revertEntry,
    promoteEntry,
    editOverride,
    countSetlistsUsing,
    findLibraryUses,
  };
}
