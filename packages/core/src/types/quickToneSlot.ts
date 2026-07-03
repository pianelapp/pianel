/**
 * Quick-tone slot snapshot.
 *
 * Each slot captures a full voicing-mode state, not just a single tone ID.
 * Applying a slot restores: voice mode + tone(s) for the captured mode +
 * mode-relevant parameters (balance, split point, octave shifts).
 *
 * Parameter fields are raw DT1 bytes when present so the slot can be applied
 * byte-for-byte without re-encoding. Fields irrelevant to the captured mode
 * are left undefined.
 */

import type {VoicingMode} from './voicingMode';

export interface QuickToneSlot {
  /** Voice mode the slot was captured in. Restored first when applied. */
  voiceMode: VoicingMode;

  /** Tone 1 / Upper / Single tone id (DT1 01 00 02 07). */
  rightToneId: string | null;
  /** Split Lower tone id (DT1 01 00 02 0A). Only meaningful when voiceMode === 'split'. */
  leftToneId: string | null;
  /** Dual Tone 2 id (DT1 01 00 02 0D). Only meaningful when voiceMode === 'dual'. */
  dualTone2Id: string | null;

  /** Split point MIDI note (DT1 01 00 02 01). Only meaningful for Split. */
  splitPoint?: number;

  /** Split balance raw byte (DT1 01 00 02 03). Only meaningful for Split. */
  balance?: number;
  /** Dual balance raw byte (DT1 01 00 02 05). Only meaningful for Dual. */
  dualBalance?: number;

  /** Split Left shift raw byte (DT1 01 00 02 02). Only meaningful for Split. */
  splitLeftShift?: number;
  /** Split Right shift raw byte (DT1 01 00 02 16). Only meaningful for Split. */
  splitRightShift?: number;

  /** Dual Tone 1 shift raw byte (DT1 01 00 02 17). Only meaningful for Dual. */
  dualT1Shift?: number;
  /** Dual Tone 2 shift raw byte (DT1 01 00 02 04). Only meaningful for Dual. */
  dualT2Shift?: number;
}
