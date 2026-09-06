/**
 * Contract tests for the Bank Select / Program Change mapping.
 *
 * These guard the two ways the table can silently rot: a tone added to
 * `tones.ts` without a matching entry here, and a transcription slip in the
 * GM2 variant counts.
 */

import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {fp30xToneCatalog} from '../../../src/engine/fp30x/tones';
import {
  GM2_VARIANTS_PER_PC,
  SN_BANK_PROGRAM,
  bankProgramForTone,
  buildChannelToneChange,
  gm2BankProgram,
  isDrumKit,
} from '../../../src/engine/fp30x/bankProgram';

describe('GM2 variant counts', () => {
  it('describes exactly 256 GM2 positions', () => {
    const total = GM2_VARIANTS_PER_PC.reduce((a, b) => a + b, 0);
    expect(GM2_VARIANTS_PER_PC).toHaveLength(128);
    expect(total).toBe(256);
  });

  it('yields LSBs that are contiguous from 0 within each program', () => {
    for (let pos = 0; pos < 256; pos++) {
      const bp = gm2BankProgram(pos)!;
      expect(bp.msb).toBe(121);
      expect(bp.lsb).toBeGreaterThanOrEqual(0);
      expect(bp.lsb).toBeLessThan(GM2_VARIANTS_PER_PC[bp.pc - 1]);
    }
  });
});

describe('catalog coverage', () => {
  it('maps every surfaced tone', () => {
    const unmapped: string[] = [];
    for (const cat of fp30xToneCatalog.categories) {
      for (const t of cat.tones) {
        if (!bankProgramForTone(t)) unmapped.push(`${t.categoryName}/${t.name}`);
      }
    }
    expect(unmapped).toEqual([]);
  });

  it('has no stale SuperNATURAL entries', () => {
    const live = new Set<string>();
    for (const cat of fp30xToneCatalog.categories) {
      for (const t of cat.tones) {
        if (t.category !== 0x08) live.add(`${t.category}-${t.position}`);
      }
    }
    expect(Object.keys(SN_BANK_PROGRAM).sort()).toEqual([...live].sort());
  });

  /**
   * The catalog total is pinned so a silent *removal* fails the build just as
   * a silent addition does — the sweep below only proves what is still there.
   */
  it('assigns every surfaced tone through the engine capability', () => {
    const engine = new FP30XEngine();
    const refused: string[] = [];
    let swept = 0;
    for (const cat of fp30xToneCatalog.categories) {
      for (const t of cat.tones) {
        swept++;
        if (!engine.planChannelToneChange(5, t).eligible) {
          refused.push(`${t.categoryName}/${t.name}`);
        }
      }
    }
    expect(refused).toEqual([]);
    expect(swept).toBe(314);
    expect(fp30xToneCatalog.totalCount).toBe(314);
  });
});

/**
 * Seven SuperNATURAL tones are the same sound as a hidden GM2 position. The
 * doc lists both, so the two tables must agree — the strongest independent
 * check available on the GM2 derivation.
 */
describe('SuperNATURAL / GM2 duplicate agreement', () => {
  const twins: Array<[string, number]> = [
    ['1-4', 22], // Clav.
    ['1-6', 24], // Celesta
    ['1-5', 27], // Vibraphone
    ['2-12', 49], // Accordion
    ['6-2', 53], // Nylon-str.Gt
    ['6-3', 57], // Steel-str.Gt
    ['6-4', 77], // AcousticBass
  ];

  it.each(twins)('%s matches GM2 position %i', (snKey, gm2Pos) => {
    expect(SN_BANK_PROGRAM[snKey]).toEqual(gm2BankProgram(gm2Pos));
  });
});

describe('drum kits', () => {
  it('exposes all nine rhythm sets in bank 120', () => {
    const kits = fp30xToneCatalog.categories.find(c => c.id === 0x07)!.tones;
    expect(kits).toHaveLength(9);
    const pcs = kits.map(t => bankProgramForTone(t)!);
    expect(pcs.every(bp => bp.msb === 120 && bp.lsb === 0)).toBe(true);
    // Steps by 8 except Electric(25) -> Analog(26).
    expect(pcs.map(bp => bp.pc)).toEqual([1, 9, 17, 25, 26, 33, 41, 49, 57]);
    expect(kits.every(isDrumKit)).toBe(true);
  });
});

describe('buildChannelToneChange', () => {
  const concertPiano = fp30xToneCatalog.findById('0-0-0')!;

  it('emits CC0, CC32, PC in that order with the channel nibble applied', () => {
    // Concert Piano on ch.5 -> MSB 0, LSB 68, PC 1 (wire 0).
    expect(buildChannelToneChange(5, concertPiano)).toEqual([
      [0xb4, 0x00, 0],
      [0xb4, 0x20, 68],
      [0xc4, 0],
    ]);
  });

  it('rejects out-of-range channels', () => {
    expect(buildChannelToneChange(0, concertPiano)).toEqual([]);
    expect(buildChannelToneChange(17, concertPiano)).toEqual([]);
  });
});
