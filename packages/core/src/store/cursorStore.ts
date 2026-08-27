/**
 * Perform-time cursor position (design §4).
 *
 * Deliberately NOT persisted — where you were in a set is meaningless after a
 * reload, and persisting it would resurrect a stale position on next launch.
 * That also means no storage adapter and no `create…Store(storage)` factory:
 * this store is a plain singleton, unlike the persisted stores around it.
 */

import {create} from 'zustand';

export interface CursorAnchor {
  entryIndex: number;
  sceneIndex: number;
}

export interface CursorState {
  /** Null when performing a single song outside a setlist (rehearsal path). */
  setlistId: string | null;
  /** The song currently being performed. Empty string when idle. */
  songId: string;
  /** Position in `setlist.entries`. Held at 0 when `setlistId` is null. */
  entryIndex: number;
  /** Position in the current song's `scenes`. */
  sceneIndex: number;
  isPerforming: boolean;
  anchor: CursorAnchor | null;
}

/**
 * Either move within the current song (`sceneIndex` alone), or move to a
 * different song (`songId` and `entryIndex` together). Changing one of the
 * pair without the other would leave the cursor pointing at two different
 * songs at once, so the type forbids it.
 */
export type CursorPosition = {sceneIndex: number} & (
  | {songId?: never; entryIndex?: never}
  | {songId: string; entryIndex: number}
);

export interface CursorActions {
  enter: (p: {
    setlistId: string | null;
    songId: string;
    entryIndex: number;
  }) => void;
  exit: () => void;
  setPosition: (p: CursorPosition) => void;
  setAnchor: (anchor: CursorAnchor) => void;
  clearAnchor: () => void;
}

const IDLE: CursorState = {
  setlistId: null,
  songId: '',
  entryIndex: 0,
  sceneIndex: 0,
  isPerforming: false,
  anchor: null,
};

export const useCursorStore = create<CursorState & CursorActions>()(set => ({
  ...IDLE,

  enter: ({setlistId, songId, entryIndex}) =>
    set({
      setlistId,
      songId,
      // Single-song mode has no setlist to index into, so the entry index is
      // pinned rather than trusted from the caller.
      entryIndex: setlistId === null ? 0 : entryIndex,
      sceneIndex: 0,
      isPerforming: true,
      anchor: null,
    }),

  exit: () => set({...IDLE}),

  setPosition: ({songId, entryIndex, sceneIndex}) =>
    set(state => ({
      songId: songId ?? state.songId,
      entryIndex: entryIndex ?? state.entryIndex,
      sceneIndex,
    })),

  setAnchor: anchor => set({anchor}),

  clearAnchor: () => set({anchor: null}),
}));
