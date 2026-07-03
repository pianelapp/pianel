import { useCallback, useMemo } from 'react';
import { usePerformanceStore, useAppSettingsStore } from '../store';
import { getPianoService } from './usePiano';
import type { Tone, ToneCategory } from '@pianel/core/types/types';
import type { ToneSlot } from '@pianel/core/types/voicingMode';
import { byteToVoicingMode } from '@pianel/core/helpers/voicingMode';

const EMPTY_CATEGORIES: ToneCategory[] = [];

function syncCategoryFromTone(tone: Tone, slot: ToneSlot): void {
  const cats = getPianoService()?.getToneCatalog()?.categories;
  if (cats) {
    const catIdx = cats.findIndex(c => c.id === tone.category);
    if (catIdx >= 0) {
      if (slot === 'left') {
        useAppSettingsStore.getState().setLastLeftCategoryIndex(catIdx);
      } else {
        useAppSettingsStore.getState().setLastCategoryIndex(catIdx);
      }
    }
  }
}

/**
 * Tone-selection hook.
 *
 * `slot`:
 *   undefined (default) — follows `appSettingsStore.activeToneSlot`. Use this in
 *                         consumers that should track whichever tone the user
 *                         is currently editing (Library sidebar, tone stepper).
 *   'right'             — pin to Tone 1 / Single / Upper (DT1 01 00 02 07-09).
 *                         Drives `activeTone`, `lastCategoryIndex`, `service.changeTone`.
 *   'left'              — pin to the second tone slot. Mode-aware:
 *                           Split → `leftTone` + DT1 01 00 02 0A (`changeLeftTone`)
 *                           Dual  → `dualTone2` + DT1 01 00 02 0D (`changeDualTone2`)
 *                         Both share `lastLeftCategoryIndex` for stepper position.
 *
 * Mode routing (Split vs Dual on the left slot) is resolved by the hook + service;
 * callers never need to read `voiceMode` themselves.
 */
export function useTones(slot?: ToneSlot) {
  const storeSlot = useAppSettingsStore(s => s.activeToneSlot);
  const resolvedSlot: ToneSlot = slot ?? storeSlot;
  const catalog = getPianoService()?.getToneCatalog() ?? null;
  const categories = catalog?.categories ?? EMPTY_CATEGORIES;

  const rightTone = usePerformanceStore(s => s.activeTone);
  const splitLowerTone = usePerformanceStore(s => s.leftTone ?? null);
  const dualTone2 = usePerformanceStore(s => s.dualTone2 ?? null);
  const voiceModeByte = usePerformanceStore(s => s.voiceMode ?? 0);
  const isDual = byteToVoicingMode(voiceModeByte) === 'dual';
  const leftSlotTone = isDual ? dualTone2 : splitLowerTone;
  const rightHistory = usePerformanceStore(s => s.toneHistory);
  const leftHistory = usePerformanceStore(s => s.leftToneHistory);
  const dualTone2History = usePerformanceStore(s => s.dualTone2History);
  const rightCatIdx = useAppSettingsStore(s => s.lastCategoryIndex);
  const leftCatIdx = useAppSettingsStore(s => s.lastLeftCategoryIndex);

  const activeTone = resolvedSlot === 'left' ? leftSlotTone : rightTone;
  const catIdx = resolvedSlot === 'left' ? leftCatIdx : rightCatIdx;
  const toneHistory =
    resolvedSlot === 'left'
      ? isDual
        ? dualTone2History
        : leftHistory
      : rightHistory;

  const setCatIdx = useCallback(
    (idx: number) => {
      if (resolvedSlot === 'left') {
        useAppSettingsStore.getState().setLastLeftCategoryIndex(idx);
      } else {
        useAppSettingsStore.getState().setLastCategoryIndex(idx);
      }
    },
    [resolvedSlot],
  );

  const currentCategory: ToneCategory = useMemo(() => {
    const i = Math.max(0, Math.min(catIdx, categories.length - 1));
    return categories[i] ?? { id: 0, name: 'Piano', tones: [] };
  }, [catIdx, categories]);

  const selectToneInternal = useCallback(
    (tone: Tone) => {
      const store = usePerformanceStore.getState();
      const service = getPianoService();
      if (resolvedSlot === 'left') {
        if (isDual) {
          store.setDualTone2(tone);
          service?.changeDualTone2(tone);
        } else {
          store.setLeftTone(tone);
          service?.changeLeftTone(tone);
        }
      } else {
        store.setActiveTone(tone);
        service?.changeTone(tone);
      }
      syncCategoryFromTone(tone, resolvedSlot);
    },
    [resolvedSlot, isDual],
  );

  const nextCategory = useCallback(() => {
    if (categories.length === 0) return;
    const nextIdx = (catIdx + 1) % categories.length;
    setCatIdx(nextIdx);
    const firstTone = categories[nextIdx]?.tones[0];
    if (firstTone) {
      selectToneInternal(firstTone);
    }
  }, [catIdx, categories, setCatIdx, selectToneInternal]);

  const prevCategory = useCallback(() => {
    if (categories.length === 0) return;
    const prevIdx = (catIdx - 1 + categories.length) % categories.length;
    setCatIdx(prevIdx);
    const firstTone = categories[prevIdx]?.tones[0];
    if (firstTone) {
      selectToneInternal(firstTone);
    }
  }, [catIdx, categories, setCatIdx, selectToneInternal]);

  const nextTone = useCallback(() => {
    const tones = currentCategory.tones;
    if (tones.length === 0) return;

    let currentIdx = -1;
    if (activeTone && activeTone.category === currentCategory.id) {
      currentIdx = tones.findIndex(t => t.id === activeTone.id);
    }
    if (currentIdx === -1) {
      selectToneInternal(tones[0]);
      return;
    }
    const nextIdx = (currentIdx + 1) % tones.length;
    selectToneInternal(tones[nextIdx]);
  }, [currentCategory, activeTone, selectToneInternal]);

  const prevTone = useCallback(() => {
    const tones = currentCategory.tones;
    if (tones.length === 0) return;

    let currentIdx = -1;
    if (activeTone && activeTone.category === currentCategory.id) {
      currentIdx = tones.findIndex(t => t.id === activeTone.id);
    }
    if (currentIdx === -1) {
      selectToneInternal(tones[0]);
      return;
    }
    const prevIdx = (currentIdx - 1 + tones.length) % tones.length;
    selectToneInternal(tones[prevIdx]);
  }, [currentCategory, activeTone, selectToneInternal]);

  const selectTone = useCallback(
    (tone: Tone) => {
      selectToneInternal(tone);
    },
    [selectToneInternal],
  );

  const undo = useCallback(() => {
    const perf = usePerformanceStore.getState();
    const service = getPianoService();
    if (resolvedSlot === 'right') {
      const previous = perf.undo();
      if (previous) {
        syncCategoryFromTone(previous, 'right');
        service?.changeTone(previous);
      }
      return;
    }
    // Left slot — route to the per-mode history.
    if (isDual) {
      const previous = perf.undoDualTone2();
      if (previous) {
        syncCategoryFromTone(previous, 'left');
        service?.changeDualTone2(previous);
      }
    } else {
      const previous = perf.undoLeftTone();
      if (previous) {
        syncCategoryFromTone(previous, 'left');
        service?.changeLeftTone(previous);
      }
    }
  }, [resolvedSlot, isDual]);

  const searchByName = useCallback(
    (query: string): Tone[] => {
      if (!query.trim() || !catalog) return [];
      return catalog.searchByName(query);
    },
    [catalog],
  );

  const findToneById = useCallback(
    (id: string) => {
      return catalog?.findById(id);
    },
    [catalog],
  );

  return {
    slot: resolvedSlot,
    categories,
    currentCategory,
    categoryIndex: catIdx,
    setCategoryIndex: setCatIdx,
    activeTone,
    toneHistory,
    nextTone,
    prevTone,
    nextCategory,
    prevCategory,
    selectTone,
    undo,
    searchByName,
    findToneById,
  };
}
