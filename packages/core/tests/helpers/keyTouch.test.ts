import {
  KEY_TOUCH_OPTIONS,
  KEY_TOUCH_DEFAULT,
  clampKeyTouch,
  keyTouchOption,
  keyTouchLabel,
  keyTouchShortLabel,
} from '../../src/helpers/keyTouch';
import {FP30XEngine} from '../../src/engine/fp30x/FP30XEngine';
import {parseNotification} from '../../src/engine/fp30x/parser';

// Captured from an FP-30X while changing Key Touch on the piano's own panel.
const PANEL_ECHOES: ReadonlyArray<{bytes: number[]; level: number}> = [
  {bytes: [0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12, 0x01, 0x00, 0x02, 0x1d, 0x04, 0x5c, 0xf7], level: 4},
  {bytes: [0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12, 0x01, 0x00, 0x02, 0x1d, 0x05, 0x5b, 0xf7], level: 5},
  {bytes: [0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12, 0x01, 0x00, 0x02, 0x1d, 0x03, 0x5d, 0xf7], level: 3},
  {bytes: [0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12, 0x01, 0x00, 0x02, 0x1d, 0x02, 0x5e, 0xf7], level: 2},
  {bytes: [0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12, 0x01, 0x00, 0x02, 0x1d, 0x01, 0x5f, 0xf7], level: 1},
  {bytes: [0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12, 0x01, 0x00, 0x02, 0x1d, 0x00, 0x60, 0xf7], level: 0},
];

describe('KEY_TOUCH_OPTIONS', () => {
  it('covers every level the piano reports, 0 through 5', () => {
    expect(KEY_TOUCH_OPTIONS.map(o => o.value)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('names the levels the way the piano panel does', () => {
    expect(KEY_TOUCH_OPTIONS.map(o => o.label)).toEqual([
      'Fix',
      'Super Light',
      'Light',
      'Medium',
      'Heavy',
      'Super Heavy',
    ]);
  });

  it('defaults to Medium', () => {
    expect(KEY_TOUCH_DEFAULT).toBe(3);
    expect(keyTouchLabel(KEY_TOUCH_DEFAULT)).toBe('Medium');
  });
});

describe('clampKeyTouch', () => {
  it('passes valid levels through untouched', () => {
    for (const option of KEY_TOUCH_OPTIONS) {
      expect(clampKeyTouch(option.value)).toBe(option.value);
    }
  });

  it('clamps out-of-range levels to the nearest end', () => {
    expect(clampKeyTouch(-3)).toBe(0);
    expect(clampKeyTouch(99)).toBe(5);
  });

  it('rounds fractional levels', () => {
    expect(clampKeyTouch(2.4)).toBe(2);
    expect(clampKeyTouch(2.6)).toBe(3);
  });
});

describe('key touch labels', () => {
  it('resolves both label forms for a known level', () => {
    expect(keyTouchLabel(1)).toBe('Super Light');
    expect(keyTouchShortLabel(1)).toBe('S.LT');
  });

  it('falls back to the raw value for an unrecognised level', () => {
    expect(keyTouchOption(9)).toBeUndefined();
    expect(keyTouchLabel(9)).toBe('9');
    expect(keyTouchShortLabel(9)).toBe('9');
  });
});

describe('hardware round-trip', () => {
  it('parses every captured panel echo into the matching level', () => {
    for (const {bytes, level} of PANEL_ECHOES) {
      expect(parseNotification(bytes)).toEqual({type: 'keyTouch', value: level});
    }
  });

  it('rebuilds each captured echo byte-for-byte, checksum included', () => {
    const engine = new FP30XEngine();
    for (const {bytes, level} of PANEL_ECHOES) {
      expect(engine.buildKeyTouchChange(level)).toEqual(bytes);
    }
  });

  it('clamps before writing so an out-of-range level never hits the wire', () => {
    const engine = new FP30XEngine();
    expect(engine.buildKeyTouchChange(42)).toEqual(
      engine.buildKeyTouchChange(5),
    );
  });
});
