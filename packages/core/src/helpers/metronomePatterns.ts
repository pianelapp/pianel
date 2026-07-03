/**
 * Metronome pattern-glyph runtime data + helpers.
 *
 * Pure data describing the metronome pattern glyphs. Each app renders these
 * shapes using its own SVG primitives (HTML on desktop, react-native-svg on
 * mobile). The geometry lives here so visual changes stay consistent across
 * platforms. Types live in `../types/metronomePatterns.ts`.
 *
 * Coordinate system: 36 × 28 viewBox, baseline (note heads sit on) at y=22,
 * stem tops at y=6, triplet bracket at y=1.5.
 */

import type {PatternShape} from '../types/metronomePatterns';

export const PATTERN_VIEWBOX_WIDTH = 36;
export const PATTERN_VIEWBOX_HEIGHT = 28;
export const PATTERN_BASELINE_Y = 22;
export const PATTERN_STEM_TOP_Y = 6;
export const PATTERN_TRIPLET_Y = 1.5;
export const PATTERN_HEAD_RX = 2.8;
export const PATTERN_HEAD_RY = 2;
export const PATTERN_HEAD_ROTATE_DEG = -22;
export const PATTERN_STROKE = 1.4;
export const PATTERN_BEAM_HEIGHT = 2;
export const PATTERN_SIXTEENTH_BEAM_HEIGHT = 1.5;
export const PATTERN_SIXTEENTH_BEAM_GAP = 3.5;

export const METRONOME_PATTERN_SHAPES: readonly PatternShape[] = [
  // 1 — two beamed eighth notes
  {
    value: 1,
    notes: [
      { head: 8, stem: 10.7 },
      { head: 22, stem: 24.7 },
    ],
    beams: 1,
    ariaLabel: 'Two beamed eighth notes',
  },
  // 2 — three beamed eighth notes (triplet)
  {
    value: 2,
    notes: [
      { head: 6, stem: 8.7 },
      { head: 16, stem: 18.7 },
      { head: 26, stem: 28.7 },
    ],
    beams: 1,
    triplet: true,
    ariaLabel: 'Eighth-note triplet',
  },
  // 3 — quarter + eighth (with flag), triplet bracket
  {
    value: 3,
    notes: [
      { head: 10, stem: 12.7 },
      { head: 22, stem: 24.7, flag: true },
    ],
    beams: 0,
    triplet: true,
    ariaLabel: 'Quarter and eighth triplet',
  },
  // 4 — four beamed sixteenth notes
  {
    value: 4,
    notes: [
      { head: 4.5, stem: 7.2 },
      { head: 13, stem: 15.7 },
      { head: 21.5, stem: 24.2 },
      { head: 30, stem: 32.7 },
    ],
    beams: 2,
    ariaLabel: 'Four beamed sixteenth notes',
  },
  // 5 — three quarter notes under a triplet bracket
  {
    value: 5,
    notes: [
      { head: 6, stem: 8.7 },
      { head: 16, stem: 18.7 },
      { head: 26, stem: 28.7 },
    ],
    beams: 0,
    triplet: true,
    ariaLabel: 'Quarter-note triplet',
  },
  // 6 — single quarter note
  {
    value: 6,
    notes: [{ head: 15, stem: 17.7 }],
    beams: 0,
    ariaLabel: 'Quarter note',
  },
  // 7 — dotted eighth note
  {
    value: 7,
    notes: [{ head: 13, stem: 15.7, flag: true, dot: true }],
    beams: 0,
    ariaLabel: 'Dotted eighth note',
  },
];

/** Convenience: triplet bracket span = first head x to last stem x. */
export function patternTripletBracketX(shape: PatternShape): { x1: number; x2: number } {
  const first = shape.notes[0];
  const last = shape.notes[shape.notes.length - 1];
  return {
    x1: first.head + 1,
    x2: last.stem + 0.3,
  };
}

/** Convenience: beam span — from first stem x to last stem x. */
export function patternBeamX(shape: PatternShape): { x: number; width: number } {
  const first = shape.notes[0];
  const last = shape.notes[shape.notes.length - 1];
  return {
    x: first.stem - 0.7,
    width: last.stem - first.stem + 1.4,
  };
}

/** SVG path for the eighth-note flag attached to the top of a stem at (stemX, topY). */
export function patternFlagPath(stemX: number, topY: number = PATTERN_STEM_TOP_Y): string {
  return `M ${stemX} ${topY} C ${stemX + 4.3} ${topY + 2}, ${stemX + 5.3} ${topY + 6}, ${stemX + 2.8} ${topY + 8.5}`;
}
