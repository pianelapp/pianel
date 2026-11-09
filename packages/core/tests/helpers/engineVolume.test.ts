import {
  ENGINE_VOLUME_MIN_POSITION,
  ENGINE_VOLUME_MAX_POSITION,
  DEFAULT_ENGINE_VOLUME_POSITION,
  ENGINE_VOLUME_MAX_VALUE,
  ENGINE_VOLUME_CURVE_EXPONENT,
  clampEngineVolumePosition,
  engineVolumeValueForPosition,
  engineVolumePositionForValue,
} from '../../src/helpers/engineVolume';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as rootBarrel from '../../src/index';

const POSITIONS = Array.from({length: 101}, (_, p) => p);

describe('engineVolume constants', () => {
  it('declares the position range, default, maximum value and exponent', () => {
    expect(ENGINE_VOLUME_MIN_POSITION).toBe(0);
    expect(ENGINE_VOLUME_MAX_POSITION).toBe(100);
    expect(DEFAULT_ENGINE_VOLUME_POSITION).toBe(100);
    expect(ENGINE_VOLUME_MAX_VALUE).toBe(127);
    expect(ENGINE_VOLUME_CURVE_EXPONENT).toBe(0.85);
  });
});

describe('engineVolumeValueForPosition', () => {
  it.each([
    [100, 127],
    [90, 116],
    [80, 105],
    [70, 94],
    [60, 82],
    [50, 70],
    [40, 58],
    [20, 32],
    [10, 18],
    [5, 10],
    [0, 0],
  ])('maps position %i to piano value %i', (position, value) => {
    expect(engineVolumeValueForPosition(position)).toBe(value);
  });

  it('produces 101 distinct values across all positions', () => {
    const values = POSITIONS.map(engineVolumeValueForPosition);
    expect(new Set(values).size).toBe(101);
  });

  it('never exceeds 127 and never drops below 0', () => {
    for (const p of POSITIONS) {
      const v = engineVolumeValueForPosition(p);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(ENGINE_VOLUME_MAX_VALUE);
      expect(Number.isInteger(v)).toBe(true);
    }
    expect(engineVolumeValueForPosition(250)).toBe(127);
    expect(engineVolumeValueForPosition(-10)).toBe(0);
  });
});

describe('engineVolumePositionForValue', () => {
  it('round-trips every position exactly', () => {
    for (const p of POSITIONS) {
      expect(engineVolumePositionForValue(engineVolumeValueForPosition(p))).toBe(p);
    }
  });

  it('maps 0 and below to 0 and clamps above 127 to 100', () => {
    expect(engineVolumePositionForValue(0)).toBe(0);
    expect(engineVolumePositionForValue(-4)).toBe(0);
    expect(engineVolumePositionForValue(127)).toBe(100);
    expect(engineVolumePositionForValue(500)).toBe(100);
  });
});

describe('clampEngineVolumePosition', () => {
  it.each([
    [-1, 0],
    [101, 100],
    [50.5, 51],
    [42, 42],
    [Number.NaN, DEFAULT_ENGINE_VOLUME_POSITION],
    [Number.POSITIVE_INFINITY, DEFAULT_ENGINE_VOLUME_POSITION],
  ])('clamps %p to %p', (input, expected) => {
    expect(clampEngineVolumePosition(input)).toBe(expected);
  });
});

describe('engineVolume public surface', () => {
  it('is exposed through the core barrel', () => {
    expect(rootBarrel.engineVolumeValueForPosition).toBe(
      engineVolumeValueForPosition,
    );
    expect(rootBarrel.DEFAULT_ENGINE_VOLUME_POSITION).toBe(100);
  });

  it('offers no dB helpers', () => {
    const names = Object.keys(rootBarrel).filter(n => /db/i.test(n) && /volume/i.test(n));
    expect(names).toEqual([]);
  });

  it('is listed as a deep import in the package exports map', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'),
    );
    expect(pkg.exports['./helpers/engineVolume']).toBe(
      './src/helpers/engineVolume.ts',
    );
  });
});
