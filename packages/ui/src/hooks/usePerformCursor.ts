import { useCallback } from 'react';
import { useCursorStore, useProfilesStore, selectActiveProfile } from '../store';
import type { Scene, Song } from '../store';
import type { SetlistCursorService } from '@pianel/core/services/cursor/SetlistCursorService';

let cursorServiceInstance: SetlistCursorService | null = null;

export function setCursorService(service: SetlistCursorService): void {
  cursorServiceInstance = service;
}

export function getCursorService(): SetlistCursorService | null {
  return cursorServiceInstance;
}

export function resetCursorService(): void {
  cursorServiceInstance = null;
}

export type NextTarget =
  | { kind: 'scene'; scene: Scene }
  | { kind: 'song'; song: Song }
  | { kind: 'end' };

const END: NextTarget = { kind: 'end' };

function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export function usePerformCursor() {
  const isPerforming = useCursorStore(s => s.isPerforming);
  const setlistId = useCursorStore(s => s.setlistId);
  const entryIndex = useCursorStore(s => s.entryIndex);
  const sceneIndex = useCursorStore(s => s.sceneIndex);
  useProfilesStore(selectActiveProfile);

  const service = getCursorService();
  const ready = service !== null && isPerforming;

  const song = ready ? safely(() => service.getCurrentSong(), null) : null;
  const scene = ready ? safely(() => service.getCurrentScene(), null) : null;
  const nextTarget = ready
    ? safely(() => service.getNextTarget() as NextTarget, END)
    : END;

  const enterSetlist = useCallback(async (id: string): Promise<void> => {
    await getCursorService()?.enterPerform({ setlistId: id });
  }, []);

  const enterSong = useCallback(async (songId: string): Promise<void> => {
    await getCursorService()?.enterPerform({ songId });
  }, []);

  const exit = useCallback((): void => {
    getCursorService()?.exitPerform();
  }, []);

  const nextScene = useCallback(async (): Promise<void> => {
    await getCursorService()?.nextScene();
  }, []);

  const prevScene = useCallback(async (): Promise<void> => {
    await getCursorService()?.prevScene();
  }, []);

  const nextSong = useCallback(async (): Promise<void> => {
    await getCursorService()?.nextSong();
  }, []);

  const prevSong = useCallback(async (): Promise<void> => {
    await getCursorService()?.prevSong();
  }, []);

  const jumpToScene = useCallback(async (index: number): Promise<void> => {
    await getCursorService()?.jumpToScene(index);
  }, []);

  const jumpToSong = useCallback(async (index: number): Promise<void> => {
    await getCursorService()?.jumpToSong(index);
  }, []);

  return {
    isPerforming,
    setlistId,
    entryIndex,
    sceneIndex,
    song,
    scene,
    nextTarget,
    enterSetlist,
    enterSong,
    exit,
    nextScene,
    prevScene,
    nextSong,
    prevSong,
    jumpToScene,
    jumpToSong,
  };
}
