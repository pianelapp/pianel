/**
 * Voicing-mode runtime helpers.
 *
 * Pure constants + functions for the FP-30X's four voicing modes. Types
 * live in `../types/voicingMode.ts`. Constitution IV (DT1 SysEx Protocol
 * Fidelity): this module is the only place that knows the byte mapping,
 * so the rest of the codebase reads semantic names.
 *
 * Source of truth: docs/roland-sysex-discovery.md §6 — Performance Parameter Block.
 */

import type {VoicingMode} from '../types/voicingMode';

/** Semantic mode -> DT1 byte at 01 00 02 00. */
export const VOICING_MODE_TO_BYTE: Readonly<Record<VoicingMode, number>> = {
  single: 0x00,
  split: 0x01,
  dual: 0x02,
  twin: 0x03,
};

const BYTE_TO_MODE: Readonly<Record<number, VoicingMode>> = {
  0x00: 'single',
  0x01: 'split',
  0x02: 'dual',
  0x03: 'twin',
};

export function byteToVoicingMode(byte: number): VoicingMode | undefined {
  return BYTE_TO_MODE[byte];
}

const SHIFT_CENTER = 0x40;
const SHIFT_WIRE_MAX = 24;

/**
 * Shift unit is **octaves**, not semitones.
 *
 * The wire encoding is `byte = 64 + octaves`, and the official Roland Piano App
 * only exposes ±3 octaves on the panel. (The original `roland-sysex-discovery`
 * doc mislabelled this as "semitones" because byte 0x41 was captured when "+1"
 * was selected — but the panel's "+1" means +1 octave, not +1 semitone.)
 *
 * Mirror the ±3 cap at the UI layer; keep encode/decode tolerant of the wider
 * wire byte range so we can still parse echoes from external sources.
 */
export const SHIFT_UI_MIN_OCTAVES = -3;
export const SHIFT_UI_MAX_OCTAVES = 3;

/** @deprecated unit is octaves, not semitones — use `SHIFT_UI_MIN_OCTAVES`. */
export const SHIFT_UI_MIN_SEMITONES = SHIFT_UI_MIN_OCTAVES;
/** @deprecated unit is octaves, not semitones — use `SHIFT_UI_MAX_OCTAVES`. */
export const SHIFT_UI_MAX_SEMITONES = SHIFT_UI_MAX_OCTAVES;

/** Encode a signed octave shift to the raw byte (center=64). Clamped to ±24
 *  octaves at the wire layer; UIs should pre-clamp to ±3 via `clampShiftForUi`. */
export function encodeShift(octaves: number): number {
  const clamped = Math.max(
    -SHIFT_WIRE_MAX,
    Math.min(SHIFT_WIRE_MAX, Math.round(octaves)),
  );
  return SHIFT_CENTER + clamped;
}

/** Decode a raw shift byte back to signed octaves. */
export function decodeShift(byte: number): number {
  return byte - SHIFT_CENTER;
}

/** Clamp an octave value to the UI-allowed range (mirrors Roland app: ±3). */
export function clampShiftForUi(octaves: number): number {
  return Math.max(
    SHIFT_UI_MIN_OCTAVES,
    Math.min(SHIFT_UI_MAX_OCTAVES, Math.round(octaves)),
  );
}

/**
 * Balance range. The DT1 wire allows 0..127 but the official Roland Piano App
 * (and the piano's internal sound engine) only uses 56..72 (±8 from center 64).
 * Verified via BLE capture of the Roland Piano App moving the balance slider
 * to both extremes — same range for both Split (DT1 0x03) and Dual (DT1 0x05).
 */
export const BALANCE_BYTE_CENTER = 0x40;
export const BALANCE_BYTE_MIN = 0x38;
export const BALANCE_BYTE_MAX = 0x48;

/** Clamp a balance byte to the official-app range (56..72). */
export function clampBalanceForUi(byte: number): number {
  return Math.max(
    BALANCE_BYTE_MIN,
    Math.min(BALANCE_BYTE_MAX, Math.round(byte)),
  );
}

/**
 * Format a balance byte as "L:R" like the Roland Piano App.
 *
 * The byte range 56..72 maps to 17 discrete display positions. Center byte 64
 * is "9:9" (both voices at max). Each step away from center reduces the
 * "quieter" voice:
 *
 *   byte 56 → "9:1"   (Tone 1 / Lower max,  other voice minimal)
 *   byte 64 → "9:9"   (center, both max)
 *   byte 72 → "1:9"   (Tone 2 / Upper max,  other voice minimal)
 *
 * Returns "9:9" for any out-of-range byte (defensive).
 */
export function balanceToLR(byte: number): string {
  const offset = byte - BALANCE_BYTE_CENTER;
  if (offset === 0) return '9:9';
  if (offset < 0) {
    const right = Math.max(0, 9 + offset);
    return `9:${right}`;
  }
  const left = Math.max(0, 9 - offset);
  return `${left}:9`;
}

/** UI-only: tab labels for the Tone-slot tab row, derived from current mode. */
export function toneSlotLabels(
  mode: VoicingMode,
): {right: string; left: string} {
  switch (mode) {
    case 'dual':
      return {right: 'TONE 1', left: 'TONE 2'};
    case 'split':
      return {right: 'UPPER', left: 'LOWER'};
    case 'twin':
      return {right: 'TWIN', left: 'TWIN'};
    case 'single':
    default:
      return {right: 'TONE', left: 'TONE'};
  }
}
