/**
 * T010: Voicing-mode helpers — byte-level mapping & shift codec tests.
 *
 * Sources of truth:
 *   docs/roland-sysex-discovery.md §6 — "Performance Parameter Block" table
 *   specs/005-piano-modes/data-model.md
 */

import {
  VOICING_MODE_TO_BYTE,
  byteToVoicingMode,
  encodeShift,
  decodeShift,
  toneSlotLabels,
  clampShiftForUi,
  SHIFT_UI_MIN_SEMITONES,
  SHIFT_UI_MAX_SEMITONES,
  BALANCE_BYTE_MIN,
  BALANCE_BYTE_MAX,
  BALANCE_BYTE_CENTER,
  clampBalanceForUi,
  balanceToLR,
} from '../src/helpers/voicingMode';
import type {VoicingMode} from '../src/types/voicingMode';

describe('VOICING_MODE_TO_BYTE', () => {
  it('maps semantic modes to the protocol bytes from discovery doc §6', () => {
    expect(VOICING_MODE_TO_BYTE.single).toBe(0x00);
    expect(VOICING_MODE_TO_BYTE.split).toBe(0x01);
    expect(VOICING_MODE_TO_BYTE.dual).toBe(0x02);
    expect(VOICING_MODE_TO_BYTE.twin).toBe(0x03);
  });
});

describe('byteToVoicingMode', () => {
  it.each<[number, VoicingMode]>([
    [0x00, 'single'],
    [0x01, 'split'],
    [0x02, 'dual'],
    [0x03, 'twin'],
  ])('byte 0x%s -> %s', (byte, mode) => {
    expect(byteToVoicingMode(byte)).toBe(mode);
  });

  it('returns undefined for unknown bytes', () => {
    for (const b of [0x04, 0x10, 0x7f, -1]) {
      expect(byteToVoicingMode(b)).toBeUndefined();
    }
  });

  it('round-trips through VOICING_MODE_TO_BYTE for all valid modes', () => {
    for (const mode of ['single', 'split', 'dual', 'twin'] as VoicingMode[]) {
      expect(byteToVoicingMode(VOICING_MODE_TO_BYTE[mode])).toBe(mode);
    }
  });
});

describe('encodeShift / decodeShift (unit = octaves)', () => {
  it('encodes 0 octaves as 0x40 (center)', () => {
    expect(encodeShift(0)).toBe(0x40);
  });

  it('encodes +1 octave as 0x41', () => {
    expect(encodeShift(1)).toBe(0x41);
  });

  it('encodes -1 octave as 0x3F', () => {
    expect(encodeShift(-1)).toBe(0x3f);
  });

  it('encodes +3 octaves (Roland app max) as 0x43', () => {
    expect(encodeShift(3)).toBe(0x43);
  });

  it('encodes -3 octaves (Roland app min) as 0x3D', () => {
    expect(encodeShift(-3)).toBe(0x3d);
  });

  it('clamps to +24 at the wire layer (UI clamps tighter via clampShiftForUi)', () => {
    expect(encodeShift(25)).toBe(0x40 + 24);
    expect(encodeShift(100)).toBe(0x40 + 24);
  });

  it('clamps to -24 at the wire layer', () => {
    expect(encodeShift(-25)).toBe(0x40 - 24);
    expect(encodeShift(-100)).toBe(0x40 - 24);
  });

  it('decodeShift is exact inverse of encodeShift across full clamped range', () => {
    for (let n = -24; n <= 24; n++) {
      expect(decodeShift(encodeShift(n))).toBe(n);
    }
  });
});

describe('clampShiftForUi — mirrors Roland Piano App ±3 octaves cap', () => {
  it('exposes the UI bounds at ±3', () => {
    expect(SHIFT_UI_MIN_SEMITONES).toBe(-3);
    expect(SHIFT_UI_MAX_SEMITONES).toBe(3);
  });

  it('passes through values within range', () => {
    for (const v of [-3, -2, -1, 0, 1, 2, 3]) {
      expect(clampShiftForUi(v)).toBe(v);
    }
  });

  it('clamps overshoots to the UI bounds, NOT the protocol bounds', () => {
    expect(clampShiftForUi(4)).toBe(3);
    expect(clampShiftForUi(12)).toBe(3);
    expect(clampShiftForUi(-4)).toBe(-3);
    expect(clampShiftForUi(-12)).toBe(-3);
  });

  it('still rounds non-integer inputs', () => {
    expect(clampShiftForUi(1.6)).toBe(2);
    expect(clampShiftForUi(-1.4)).toBe(-1);
  });
});

describe('balance byte range — verified via BLE capture of Roland Piano App', () => {
  it('exposes range 56..72 with center 64', () => {
    expect(BALANCE_BYTE_MIN).toBe(0x38);
    expect(BALANCE_BYTE_MAX).toBe(0x48);
    expect(BALANCE_BYTE_CENTER).toBe(0x40);
  });

  it('clampBalanceForUi keeps values inside the official-app window', () => {
    expect(clampBalanceForUi(0)).toBe(0x38);
    expect(clampBalanceForUi(56)).toBe(0x38);
    expect(clampBalanceForUi(64)).toBe(0x40);
    expect(clampBalanceForUi(72)).toBe(0x48);
    expect(clampBalanceForUi(127)).toBe(0x48);
  });
});

describe('balanceToLR — Roland Piano App L:R display', () => {
  it('renders center as "9:9"', () => {
    expect(balanceToLR(0x40)).toBe('9:9');
  });

  it('renders below-center as "9:N" (Tone 2 / Upper attenuated)', () => {
    expect(balanceToLR(0x3f)).toBe('9:8');
    expect(balanceToLR(0x3c)).toBe('9:5');
    expect(balanceToLR(0x38)).toBe('9:1');
  });

  it('renders above-center as "N:9" (Tone 1 / Lower attenuated)', () => {
    expect(balanceToLR(0x41)).toBe('8:9');
    expect(balanceToLR(0x44)).toBe('5:9');
    expect(balanceToLR(0x48)).toBe('1:9');
  });
});

describe('toneSlotLabels', () => {
  it('returns TONE 1 / TONE 2 in dual mode', () => {
    expect(toneSlotLabels('dual')).toEqual({right: 'TONE 1', left: 'TONE 2'});
  });

  it('returns UPPER / LOWER in split mode', () => {
    expect(toneSlotLabels('split')).toEqual({right: 'UPPER', left: 'LOWER'});
  });

  it('returns single-tone labels for single/twin (unused but stable)', () => {
    expect(toneSlotLabels('single').right.length).toBeGreaterThan(0);
    expect(toneSlotLabels('twin').right.length).toBeGreaterThan(0);
  });
});
