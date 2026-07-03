/**
 * Voicing-mode type aliases.
 *
 * Pure type definitions for the FP-30X's four voicing modes plus the
 * tone-slot and shift-target discriminators. Runtime helpers live in
 * `../helpers/voicingMode.ts` and depend on these types.
 */

/** Semantic voicing-mode identifiers. */
export type VoicingMode = 'single' | 'dual' | 'split' | 'twin';

/** Identifies which tone-address block a UI slot targets.
 *  right -> 01 00 02 07-09 (Single / Tone 1 / Upper)
 *  left  -> 01 00 02 0A-0C (Tone 2 / Lower; unused in Single/Twin) */
export type ToneSlot = 'right' | 'left';

/** Identifies which shift parameter to write.
 *  split-left  -> 01 00 02 02
 *  dual-tone2  -> 01 00 02 04
 *  split-right -> 01 00 02 16
 *  dual-tone1  -> 01 00 02 17 */
export type ShiftTarget =
  | 'split-left'
  | 'split-right'
  | 'dual-tone1'
  | 'dual-tone2';
