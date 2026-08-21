import { useCallback, useMemo } from 'react';
import { useProfilesStore, selectActiveProfile } from '../store';
import type { Preset, Scene, Song } from '../store';
import type { SongService } from '@pianel/core/services/songs/SongService';
import { requireConnectedPiano } from './captureGuard';

let songServiceInstance: SongService | null = null;

export function setSongService(service: SongService): void {
  songServiceInstance = service;
}

export function getSongService(): SongService | null {
  return songServiceInstance;
}

export function resetSongService(): void {
  songServiceInstance = null;
}

const EMPTY: Song[] = [];

export function useSongs() {
  const activeProfile = useProfilesStore(selectActiveProfile);
  const songs = useMemo(() => activeProfile?.songs ?? EMPTY, [activeProfile]);

  const createSong = useCallback((name: string): Song | null => {
    return getSongService()?.createSong(name) ?? null;
  }, []);

  const renameSong = useCallback((songId: string, name: string): void => {
    getSongService()?.renameSong(songId, name);
  }, []);

  const deleteSong = useCallback((songId: string): void => {
    getSongService()?.deleteSong(songId);
  }, []);

  const setSongNotes = useCallback((songId: string, notes: string): void => {
    getSongService()?.setSongNotes(songId, notes);
  }, []);

  const captureScene = useCallback((songId: string, label?: string): Scene | null => {
    if (!requireConnectedPiano()) return null;
    return getSongService()?.captureScene(songId, label) ?? null;
  }, []);

  const recaptureScene = useCallback((songId: string, sceneId: string): Scene | null => {
    if (!requireConnectedPiano()) return null;
    return getSongService()?.recaptureScene(songId, sceneId) ?? null;
  }, []);

  const renameScene = useCallback(
    (songId: string, sceneId: string, label: string): void => {
      getSongService()?.renameScene(songId, sceneId, label);
    },
    [],
  );

  const setSceneNotes = useCallback(
    (songId: string, sceneId: string, notes: string): void => {
      getSongService()?.setSceneNotes(songId, sceneId, notes);
    },
    [],
  );

  const moveScene = useCallback(
    (songId: string, from: number, to: number): void => {
      getSongService()?.moveScene(songId, from, to);
    },
    [],
  );

  const deleteScene = useCallback((songId: string, sceneId: string): void => {
    getSongService()?.deleteScene(songId, sceneId);
  }, []);

  const addPadAsScene = useCallback(
    (songId: string, pad: Preset): Scene | null =>
      getSongService()?.addPadAsScene(songId, pad) ?? null,
    [],
  );

  const editSong = useCallback(
    (songId: string, transform: (song: Song) => Song): Song | null =>
      getSongService()?.editSong(songId, transform) ?? null,
    [],
  );

  return {
    songs,
    createSong,
    renameSong,
    deleteSong,
    setSongNotes,
    captureScene,
    recaptureScene,
    renameScene,
    setSceneNotes,
    moveScene,
    deleteScene,
    addPadAsScene,
    editSong,
  };
}
