/**
 * Quick-tone slot helpers — pure functions, no store access.
 *
 * - `captureQuickToneSlot` snapshots a performance state into a slot.
 * - `slotIdentityEquals` checks structural identity (mode + tones) for the
 *   "is this slot currently active?" UI hint. Parameter values are not
 *   compared because they're easy to drift one byte off and would make the
 *   highlight feel flaky.
 */

import type {QuickToneSlot} from '../types/quickToneSlot';
import type {VoicingMode} from '../types/voicingMode';
import {byteToVoicingMode} from './voicingMode';

/** Minimal subset of the performance store needed to capture a slot. */
export interface CaptureSource {
  voiceMode?: number;
  activeTone: {id: string} | null;
  leftTone?: {id: string} | null;
  dualTone2?: {id: string} | null;
  splitPoint?: number;
  balance?: number;
  dualBalance?: number;
  splitLeftShift?: number;
  splitRightShift?: number;
  dualT1Shift?: number;
  dualT2Shift?: number;
}

/**
 * Snapshot the relevant subset of performance state into a `QuickToneSlot`.
 * Only the fields meaningful to the captured `voiceMode` are populated;
 * the rest are left undefined so the slot stays small and unambiguous.
 */
export function captureQuickToneSlot(src: CaptureSource): QuickToneSlot {
  const mode: VoicingMode =
    byteToVoicingMode(src.voiceMode ?? 0) ?? 'single';

  const slot: QuickToneSlot = {
    voiceMode: mode,
    rightToneId: src.activeTone?.id ?? null,
    leftToneId: src.leftTone?.id ?? null,
    dualTone2Id: src.dualTone2?.id ?? null,
  };

  if (mode === 'split') {
    if (src.splitPoint !== undefined) slot.splitPoint = src.splitPoint;
    if (src.balance !== undefined) slot.balance = src.balance;
    if (src.splitLeftShift !== undefined) slot.splitLeftShift = src.splitLeftShift;
    if (src.splitRightShift !== undefined) slot.splitRightShift = src.splitRightShift;
  } else if (mode === 'dual') {
    if (src.dualBalance !== undefined) slot.dualBalance = src.dualBalance;
    if (src.dualT1Shift !== undefined) slot.dualT1Shift = src.dualT1Shift;
    if (src.dualT2Shift !== undefined) slot.dualT2Shift = src.dualT2Shift;
  }
  // 'single' and 'twin' have no mode-specific params to capture.

  return slot;
}

/**
 * Structural identity for the "is this slot active right now?" UI hint.
 * Mode + the tone fields relevant to that mode. Parameter values are
 * intentionally excluded — see file header.
 */
export function slotIdentityEquals(
  slot: QuickToneSlot,
  src: CaptureSource,
): boolean {
  const currentMode: VoicingMode =
    byteToVoicingMode(src.voiceMode ?? 0) ?? 'single';
  if (slot.voiceMode !== currentMode) return false;

  if ((slot.rightToneId ?? null) !== (src.activeTone?.id ?? null)) return false;

  switch (slot.voiceMode) {
    case 'split':
      return (slot.leftToneId ?? null) === (src.leftTone?.id ?? null);
    case 'dual':
      return (slot.dualTone2Id ?? null) === (src.dualTone2?.id ?? null);
    case 'single':
    case 'twin':
    default:
      return true;
  }
}

/** Short single-line label for a slot — used by the UI to render the slot tile. */
export function slotShortLabel(
  slot: QuickToneSlot,
  toneNameById: (id: string) => string | undefined,
): string {
  const right = slot.rightToneId ? (toneNameById(slot.rightToneId) ?? '?') : '—';
  switch (slot.voiceMode) {
    case 'split': {
      const left = slot.leftToneId
        ? (toneNameById(slot.leftToneId) ?? '?')
        : '—';
      return `${right} / ${left}`;
    }
    case 'dual': {
      const t2 = slot.dualTone2Id
        ? (toneNameById(slot.dualTone2Id) ?? '?')
        : '—';
      return `${right} + ${t2}`;
    }
    case 'twin':
      return `${right} (Twin)`;
    case 'single':
    default:
      return right;
  }
}
