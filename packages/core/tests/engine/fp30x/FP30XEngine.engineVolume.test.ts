import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative, resolve, sep} from 'node:path';
import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {buildUniversalMasterVolume} from '../../../src/engine/fp30x/sysex';

const SRC = resolve(__dirname, '../../../src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

function containsSequence(source: string, bytes: number[]): boolean {
  const hex = bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`);
  const pattern = new RegExp(hex.join('\\s*,\\s*'), 'i');
  return pattern.test(source);
}

describe('FP30XEngine Engine Volume', () => {
  const engine = new FP30XEngine();

  it('declares Engine Volume support', () => {
    expect(engine.supportsEngineVolume).toBe(true);
  });

  it.each([
    [0, 0x00],
    [1, 0x01],
    [94, 0x5e],
    [127, 0x7f],
  ])('builds the Universal Realtime Master Volume for %i', (value, vv) => {
    expect(engine.buildEngineVolumeChange(value)).toEqual([
      0xf0, 0x7f, 0x7f, 0x04, 0x01, 0x00, vv, 0xf7,
    ]);
  });

  it.each([
    [-5, 0],
    [200, 127],
    [70.6, 71],
    [Number.NaN, 0],
  ])('clamps and rounds %p to %i', (value, vv) => {
    expect(engine.buildEngineVolumeChange(value)[6]).toBe(vv);
  });

  it('delegates to the sysex builder', () => {
    expect(engine.buildEngineVolumeChange(82)).toEqual(
      buildUniversalMasterVolume(82),
    );
  });
});

describe('Engine Volume protocol guards', () => {
  const files = walk(SRC);

  it('keeps the Master Volume byte sequence inside the engine directory', () => {
    const offenders = files
      .filter(f => containsSequence(readFileSync(f, 'utf-8'), [0x7f, 0x7f, 0x04, 0x01]))
      .map(f => relative(SRC, f))
      .filter(f => !f.startsWith(`engine${sep}`));
    expect(offenders).toEqual([]);
  });

  it('finds the Master Volume byte sequence in the FP-30X engine', () => {
    const sources = files
      .filter(f => relative(SRC, f).startsWith(join('engine', 'fp30x')))
      .map(f => readFileSync(f, 'utf-8'));
    expect(sources.some(s => containsSequence(s, [0x7f, 0x7f, 0x04, 0x01]))).toBe(
      true,
    );
  });

  it('never sends GM System On from core source', () => {
    const offenders = files
      .filter(f => containsSequence(readFileSync(f, 'utf-8'), [0x7e, 0x7f, 0x09]))
      .map(f => relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
