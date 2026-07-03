/**
 * T011: FP30XEngine — shift + twin-mode builder tests.
 *
 * Byte-level assertions against discovery doc §6:
 *   01 00 02 02 — Split — Left Shift
 *   01 00 02 04 — Dual — Tone 2 Shift
 *   01 00 02 06 — Twin Pair/Individual
 *   01 00 02 16 — Split — Right Shift
 *   01 00 02 17 — Dual — Tone 1 Shift
 *
 * Roland DT1 framing: F0 41 10 00 00 00 28 12 [addr×4] [data] [chk] F7
 * Shift encoding: center=0x40 = 0 octaves (see encodeShift). Unit is OCTAVES.
 */

import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {rolandChecksum} from '../../../src/engine/fp30x/sysex';

const engine = new FP30XEngine();

const HEADER = [0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12];

function expectDT1(
  msg: number[],
  address: number[],
  data: number[],
): void {
  const chk = rolandChecksum([...address, ...data]);
  expect(msg).toEqual([...HEADER, ...address, ...data, chk, 0xf7]);
}

describe('buildShiftChange (unit = octaves)', () => {
  it('split-left at 0 octaves writes 01 00 02 02 40', () => {
    expectDT1(
      engine.buildShiftChange('split-left', 0),
      [0x01, 0x00, 0x02, 0x02],
      [0x40],
    );
  });

  it('split-left at +1 octave writes 01 00 02 02 41', () => {
    expectDT1(
      engine.buildShiftChange('split-left', 1),
      [0x01, 0x00, 0x02, 0x02],
      [0x41],
    );
  });

  it('split-left at -1 octave writes 01 00 02 02 3F', () => {
    expectDT1(
      engine.buildShiftChange('split-left', -1),
      [0x01, 0x00, 0x02, 0x02],
      [0x3f],
    );
  });

  it('dual-tone2 at +3 octaves (Roland app max) writes 01 00 02 04 43', () => {
    expectDT1(
      engine.buildShiftChange('dual-tone2', 3),
      [0x01, 0x00, 0x02, 0x04],
      [0x43],
    );
  });

  it('split-right at -1 octave writes 01 00 02 16 3F', () => {
    expectDT1(
      engine.buildShiftChange('split-right', -1),
      [0x01, 0x00, 0x02, 0x16],
      [0x3f],
    );
  });

  it('dual-tone1 at +3 octaves writes 01 00 02 17 43', () => {
    expectDT1(
      engine.buildShiftChange('dual-tone1', 3),
      [0x01, 0x00, 0x02, 0x17],
      [0x43],
    );
  });

  it('dual-tone1 at -3 octaves writes 01 00 02 17 3D', () => {
    expectDT1(
      engine.buildShiftChange('dual-tone1', -3),
      [0x01, 0x00, 0x02, 0x17],
      [0x3d],
    );
  });
});

describe('buildTwinModeSet', () => {
  it('pair writes 01 00 02 06 00', () => {
    expectDT1(
      engine.buildTwinModeSet('pair'),
      [0x01, 0x00, 0x02, 0x06],
      [0x00],
    );
  });

  it('individual writes 01 00 02 06 01 (defined for completeness; never called by service)', () => {
    expectDT1(
      engine.buildTwinModeSet('individual'),
      [0x01, 0x00, 0x02, 0x06],
      [0x01],
    );
  });
});

describe('buildDualTone2Change', () => {
  it('writes [cat, hi, lo] burst to 01 00 02 0D (NOT 0A)', () => {
    expectDT1(
      engine.buildDualTone2Change({
        id: 'sn-strings-1',
        name: 'Strings 1',
        category: 0x03,
        categoryName: 'Strings',
        indexHigh: 0x00,
        indexLow: 0x00,
        position: 0,
        isGM2: false,
      }),
      [0x01, 0x00, 0x02, 0x0d],
      [0x03, 0x00, 0x00],
    );
  });
});

describe('buildDualBalanceChange', () => {
  it('writes Dual balance bytes to 01 00 02 05 (NOT 03)', () => {
    expectDT1(
      engine.buildDualBalanceChange(64),
      [0x01, 0x00, 0x02, 0x05],
      [0x40],
    );
  });

  it('clamps to wire byte range 0..127', () => {
    expectDT1(
      engine.buildDualBalanceChange(150),
      [0x01, 0x00, 0x02, 0x05],
      [0x7f],
    );
    expectDT1(
      engine.buildDualBalanceChange(-5),
      [0x01, 0x00, 0x02, 0x05],
      [0x00],
    );
  });
});

describe('existing voicing-mode builders (regression — already implemented)', () => {
  it('buildVoiceModeChange(2) writes Dual byte 0x02 to 01 00 02 00', () => {
    expectDT1(
      engine.buildVoiceModeChange(2),
      [0x01, 0x00, 0x02, 0x00],
      [0x02],
    );
  });

  it('buildSplitPointChange(54) writes F#3 (0x36) to 01 00 02 01', () => {
    expectDT1(
      engine.buildSplitPointChange(54),
      [0x01, 0x00, 0x02, 0x01],
      [0x36],
    );
  });

  it('buildBalanceChange(80) writes 0x50 to 01 00 02 03', () => {
    expectDT1(
      engine.buildBalanceChange(80),
      [0x01, 0x00, 0x02, 0x03],
      [0x50],
    );
  });
});
