import type { Tone } from '../../types/types';

/** GM2 Bank Select MSB — every GM2 tone lives in bank 121. */
export const GM2_BANK_MSB = 121;

/** Drum-kit Bank Select MSB — the 9 rhythm sets live in bank 120. */
export const DRUM_BANK_MSB = 120;

/** A Bank Select + Program Change triple. `pc` is 1-based (wire value is pc-1). */
export interface BankProgram {
  /** Bank Select MSB — CC0 value. */
  msb: number;
  /** Bank Select LSB — CC32 value. */
  lsb: number;
  /** Program number 1-128 as printed in the doc. Wire byte is `pc - 1`. */
  pc: number;
}

/**
 * SuperNATURAL tones (DT1 categories 0x00-0x07), keyed by `category-position`.
 * Positions match the arrays in `tones.ts` exactly.
 *
 * Seven of these are also reachable as GM2 tones (Clav., Celesta, Vibraphone,
 * Accordion, Nylon-str.Gt, Steel-str.Gt, AcousticBass) and carry bank 121 —
 * they are the same sound.
 */
export const SN_BANK_PROGRAM: Readonly<Record<string, BankProgram>> = {
  // ── Category 0x00 — Piano ──
  '0-0': { msb: 0, lsb: 68, pc: 1 }, // Concert Piano
  '0-1': { msb: 16, lsb: 67, pc: 1 }, // Ballad Piano
  '0-2': { msb: 4, lsb: 64, pc: 1 }, // Mellow Piano
  '0-3': { msb: 8, lsb: 66, pc: 2 }, // Bright Piano
  '0-4': { msb: 16, lsb: 64, pc: 1 }, // Upright Piano
  '0-5': { msb: 1, lsb: 65, pc: 1 }, // Mellow Upright
  '0-6': { msb: 1, lsb: 66, pc: 1 }, // Bright Upright
  '0-7': { msb: 8, lsb: 64, pc: 3 }, // Rock Piano
  '0-8': { msb: 0, lsb: 64, pc: 4 }, // Ragtime Piano
  '0-9': { msb: 47, lsb: 65, pc: 3 }, // Magical Piano
  '0-10': { msb: 0, lsb: 67, pc: 7 }, // Harpsichord
  '0-11': { msb: 8, lsb: 67, pc: 7 }, // Harpsi 8'+4'

  // ── Category 0x01 — E.Piano ──
  '1-0': { msb: 8, lsb: 71, pc: 5 }, // 1976SuitCase
  '1-1': { msb: 25, lsb: 64, pc: 5 }, // Wurly 200
  '1-2': { msb: 8, lsb: 68, pc: 5 }, // Phase EP Mix
  '1-3': { msb: 0, lsb: 68, pc: 6 }, // 80's FM EP
  '1-4': { msb: 121, lsb: 0, pc: 8 }, // Clav.        (GM2 twin: pos 22)
  '1-5': { msb: 121, lsb: 0, pc: 12 }, // Vibraphone  (GM2 twin: pos 27)
  '1-6': { msb: 121, lsb: 0, pc: 9 }, // Celesta      (GM2 twin: pos 24)

  // ── Category 0x02 — Organ ──
  '2-0': { msb: 1, lsb: 65, pc: 19 }, // B.Organ Slow
  '2-1': { msb: 0, lsb: 70, pc: 19 }, // Combo Jz.Org
  '2-2': { msb: 0, lsb: 69, pc: 19 }, // Ballad Organ
  '2-3': { msb: 0, lsb: 71, pc: 17 }, // Gospel Spin
  '2-4': { msb: 0, lsb: 69, pc: 17 }, // Full Stops
  '2-5': { msb: 32, lsb: 68, pc: 17 }, // Mellow Bars
  '2-6': { msb: 0, lsb: 66, pc: 17 }, // Lower Organ
  '2-7': { msb: 32, lsb: 69, pc: 17 }, // Light Organ
  '2-8': { msb: 8, lsb: 70, pc: 20 }, // Pipe Organ
  '2-9': { msb: 16, lsb: 66, pc: 20 }, // Nason Flt 8'
  '2-10': { msb: 0, lsb: 66, pc: 20 }, // ChurchOrgan1
  '2-11': { msb: 8, lsb: 69, pc: 20 }, // ChurchOrgan2
  '2-12': { msb: 121, lsb: 0, pc: 22 }, // Accordion   (GM2 twin: pos 49)

  // ── Category 0x03 — Strings ──
  '3-0': { msb: 1, lsb: 67, pc: 49 }, // Epic Strings
  '3-1': { msb: 0, lsb: 71, pc: 50 }, // Rich Strings
  '3-2': { msb: 1, lsb: 67, pc: 50 }, // SymphonicStr1
  '3-3': { msb: 1, lsb: 65, pc: 50 }, // SymphonicStr2
  '3-4': { msb: 8, lsb: 66, pc: 49 }, // Orchestra
  '3-5': { msb: 0, lsb: 64, pc: 41 }, // String Trio
  '3-6': { msb: 0, lsb: 70, pc: 47 }, // Harpiness
  '3-7': { msb: 1, lsb: 66, pc: 61 }, // OrchestraBrs

  // ── Category 0x04 — Pad ──
  '4-0': { msb: 1, lsb: 71, pc: 90 }, // Super SynPad
  '4-1': { msb: 8, lsb: 71, pc: 53 }, // Choir Aahs 1
  '4-2': { msb: 8, lsb: 72, pc: 53 }, // Choir Aahs 2
  '4-3': { msb: 1, lsb: 64, pc: 89 }, // D50 StackPad
  '4-4': { msb: 0, lsb: 68, pc: 51 }, // JP8 Strings
  '4-5': { msb: 0, lsb: 64, pc: 90 }, // Soft Pad
  '4-6': { msb: 0, lsb: 66, pc: 51 }, // Solina

  // ── Category 0x05 — Synth ──
  '5-0': { msb: 8, lsb: 67, pc: 82 }, // Super Saw
  '5-1': { msb: 1, lsb: 65, pc: 91 }, // Trancy Synth
  '5-2': { msb: 1, lsb: 64, pc: 91 }, // Flip Pad

  // ── Category 0x06 — Other ──
  '6-0': { msb: 0, lsb: 65, pc: 55 }, // Jazz Scat
  '6-1': { msb: 0, lsb: 66, pc: 34 }, // Comp'd JBass
  '6-2': { msb: 121, lsb: 0, pc: 25 }, // Nylon-str.Gt (GM2 twin: pos 53)
  '6-3': { msb: 121, lsb: 0, pc: 26 }, // Steel-str.Gt (GM2 twin: pos 57)
  '6-4': { msb: 121, lsb: 0, pc: 33 }, // AcousticBass (GM2 twin: pos 77)
  '6-5': { msb: 0, lsb: 66, pc: 33 }, // A.Bass+Cymbl

  // ── Category 0x07 — Drums (rhythm sets, bank 120) ──
  '7-0': { msb: 120, lsb: 0, pc: 1 }, // Standard Set
  '7-1': { msb: 120, lsb: 0, pc: 9 }, // Room Set
  '7-2': { msb: 120, lsb: 0, pc: 17 }, // Power Set
  '7-3': { msb: 120, lsb: 0, pc: 25 }, // Electric Set
  '7-4': { msb: 120, lsb: 0, pc: 26 }, // Analog Set
  '7-5': { msb: 120, lsb: 0, pc: 33 }, // Jazz Set
  '7-6': { msb: 120, lsb: 0, pc: 41 }, // Brush Set
  '7-7': { msb: 120, lsb: 0, pc: 49 }, // Orchestra Set
  '7-8': { msb: 120, lsb: 0, pc: 57 }, // SFX Set
};

/**
 * Number of LSB variations per Program Change, for GM2 programs 1-128.
 *
 * The doc's GM2 Tone List is a flat run of 256 entries ordered by PC, with
 * each PC followed by its LSB variations (0, 1, 2...). Storing the variant
 * counts instead of 256 literal pairs keeps this verifiable at a glance:
 * the array has 128 entries and must sum to 256.
 *
 * Index i corresponds to PC (i + 1).
 */
export const GM2_VARIANTS_PER_PC: readonly number[] = [
  // PC 1-16
  3, 2, 2, 2, 4, 5, 4, 2, 1, 1, 1, 2, 2, 1, 3, 1,
  // PC 17-32
  4, 3, 1, 3, 2, 2, 1, 1, 4, 4, 2, 3, 4, 2, 3, 2,
  // PC 33-48
  1, 2, 1, 1, 1, 1, 5, 4, 2, 1, 1, 1, 1, 1, 2, 1,
  // PC 49-64
  3, 1, 2, 1, 2, 2, 2, 4, 2, 3, 1, 2, 2, 2, 4, 3,
  // PC 65-80 (solo winds/reeds — one variation each)
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  // PC 81-96
  3, 5, 1, 1, 2, 1, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1,
  // PC 97-112
  1, 1, 2, 1, 1, 1, 3, 1, 2, 1, 1, 2, 1, 1, 1, 1,
  // PC 113-128 (SFX banks are the deep ones: PC 126 has 10 variations)
  1, 1, 1, 2, 2, 2, 3, 1, 3, 2, 6, 4, 6, 10, 6, 4,
];

/** Lazily-built position -> BankProgram table for the 256 GM2 slots. */
let gm2Table: BankProgram[] | null = null;

function buildGM2Table(): BankProgram[] {
  const table: BankProgram[] = [];
  GM2_VARIANTS_PER_PC.forEach((variants, i) => {
    for (let lsb = 0; lsb < variants; lsb++) {
      table.push({ msb: GM2_BANK_MSB, lsb, pc: i + 1 });
    }
  });
  return table;
}

/**
 * Bank/program for a GM2 catalog position (0-255).
 * Returns null for out-of-range positions.
 */
export function gm2BankProgram(position: number): BankProgram | null {
  if (!Number.isInteger(position) || position < 0 || position > 255)
    return null;
  gm2Table ??= buildGM2Table();
  return gm2Table[position] ?? null;
}

/**
 * Resolve any catalog `Tone` to its Bank Select + Program Change triple.
 *
 * Returns null when the tone is unknown — callers must treat that as "skip
 * the write" rather than falling back to a default, since a wrong program on
 * a live channel is worse than no change.
 */
export function bankProgramForTone(tone: Tone): BankProgram | null {
  if (tone.category === 0x08) return gm2BankProgram(tone.position);
  return SN_BANK_PROGRAM[`${tone.category}-${tone.position}`] ?? null;
}

/**
 * Build the three channel-voice messages that place `tone` on `channel`.
 *
 * Emitted in the order the piano requires: CC0 (bank MSB), CC32 (bank LSB),
 * Program Change. Returns an empty array when the tone has no known mapping.
 *
 * @param channel 1-16 (human numbering; wire nibble is channel - 1)
 */
export function buildChannelToneChange(
  channel: number,
  tone: Tone,
): number[][] {
  const bp = bankProgramForTone(tone);
  if (!bp) return [];
  if (!Number.isInteger(channel) || channel < 1 || channel > 16) return [];

  const n = channel - 1;
  return [
    [0xb0 | n, 0x00, bp.msb],
    [0xb0 | n, 0x20, bp.lsb],
    [0xc0 | n, bp.pc - 1],
  ];
}

/** True iff `tone` is one of the nine rhythm sets (the only MIDI ch.10 voices). */
export function isDrumKit(tone: Tone): boolean {
  return tone.category === 0x07;
}
