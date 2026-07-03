import { useCallback } from 'react';
import {
  byteToVoicingMode,
  decodeShift,
  toneSlotLabels,
  clampBalanceForUi,
  BALANCE_BYTE_CENTER,
} from '@pianel/core/helpers/voicingMode';
import type {
  VoicingMode,
  ToneSlot,
  ShiftTarget,
} from '@pianel/core/types/voicingMode';
import { usePerformanceStore, useAppSettingsStore } from '../store';
import { getPianoService } from './usePiano';

/**
 * Voicing-mode hook.
 *
 * Reads mode + per-slot tones + per-mode parameters from the shared store,
 * exposes action creators that delegate to PianoService.
 *
 * Per Constitution Principle V the renderer never imports engine/transport
 * directly — all writes go through PianoService.
 */
export function useVoicingMode() {
  const voiceModeByte = usePerformanceStore(s => s.voiceMode ?? 0);
  const mode: VoicingMode = byteToVoicingMode(voiceModeByte) ?? 'single';

  // Active slot lives in the shared app-settings store so every consumer — the
  // slot tabs, the tone steppers, and the Library sidebar — stays in sync.
  // PianoService.changeVoiceMode resets it to 'right' on Single/Twin entry.
  const activeSlot = useAppSettingsStore(s => s.activeToneSlot);
  const setActiveSlot = useCallback((slot: ToneSlot) => {
    useAppSettingsStore.getState().setActiveToneSlot(slot);
  }, []);

  const tone1 = usePerformanceStore(s => s.activeTone);
  const splitLowerTone = usePerformanceStore(s => s.leftTone ?? null);
  const dualTone2 = usePerformanceStore(s => s.dualTone2 ?? null);
  // The "second tone" presented to the UI depends on the active mode:
  // Dual → dualTone2 (01 00 02 0D), Split → leftTone (01 00 02 0A).
  const tone2 = mode === 'dual' ? dualTone2 : splitLowerTone;
  const splitBalanceByte = usePerformanceStore(s => s.balance ?? BALANCE_BYTE_CENTER);
  const dualBalanceByte = usePerformanceStore(s => s.dualBalance ?? BALANCE_BYTE_CENTER);
  // Surface the correct balance register for the current mode.
  const balance = mode === 'dual' ? dualBalanceByte : splitBalanceByte;
  const splitPoint = usePerformanceStore(s => s.splitPoint ?? 54);
  const dualT1ShiftByte = usePerformanceStore(s => s.dualT1Shift ?? 64);
  const dualT2ShiftByte = usePerformanceStore(s => s.dualT2Shift ?? 64);
  const splitLeftShiftByte = usePerformanceStore(s => s.splitLeftShift ?? 64);
  const splitRightShiftByte = usePerformanceStore(s => s.splitRightShift ?? 64);

  const changeMode = useCallback((next: VoicingMode) => {
    const service = getPianoService();
    service?.changeVoiceMode(next);
  }, []);

  const changeBalance = useCallback((value: number) => {
    // Clamp at the UI layer to the official-app range (56..72). The service
    // routes to the correct register (Split 0x03 vs Dual 0x05) based on
    // current voice mode.
    getPianoService()?.changeBalance(clampBalanceForUi(value));
  }, []);

  const changeSplitPoint = useCallback((note: number) => {
    const n = Math.max(21, Math.min(108, Math.round(note)));
    getPianoService()?.changeSplitPoint(n);
  }, []);

  const changeShift = useCallback((target: ShiftTarget, semitones: number) => {
    getPianoService()?.changeShift(target, semitones);
  }, []);

  return {
    mode,
    activeSlot,
    setActiveSlot,
    slotLabels: toneSlotLabels(mode),
    tone1,
    tone2,
    balance,
    splitPoint,
    dualT1Shift: decodeShift(dualT1ShiftByte),
    dualT2Shift: decodeShift(dualT2ShiftByte),
    splitLeftShift: decodeShift(splitLeftShiftByte),
    splitRightShift: decodeShift(splitRightShiftByte),
    changeMode,
    changeBalance,
    changeSplitPoint,
    changeShift,
  };
}
