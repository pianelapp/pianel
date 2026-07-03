/**
 * Metronome pattern-glyph type aliases.
 *
 * Pure type definitions describing the geometry of a metronome rhythm-pattern
 * glyph. Runtime constants and helpers live in
 * `../helpers/metronomePatterns.ts` and depend on these types.
 */

export interface PatternNoteSpec {
  /** Note-head center x. */
  head: number;
  /** Stem x (right side of the head). */
  stem: number;
  /** Render a single eighth-note flag from the top of this stem. */
  flag?: boolean;
  /** Render an augmentation dot to the right of the head. */
  dot?: boolean;
}

export interface PatternShape {
  /** Pattern value (matches DT1 byte sent to the piano: 1..7). */
  value: number;
  notes: PatternNoteSpec[];
  /** 0 = no beam, 1 = eighth-note beam, 2 = sixteenth-note (double) beam. */
  beams: 0 | 1 | 2;
  /** Show the "3" triplet bracket above the group. */
  triplet?: boolean;
  /** Human-readable label for accessibility. */
  ariaLabel: string;
}
