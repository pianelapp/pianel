import {DEFAULT_PERFORMANCE_SNAPSHOT} from '@pianel/core/types/performanceSnapshot';
import type {PerformanceSnapshot} from '@pianel/core/types/performanceSnapshot';
import {summariseScene, noteName} from '../../src/helpers/sceneSummary';

const NAMES: Record<string, string> = {
  'a': 'Concert Piano',
  'b': 'Strings',
  'c': 'E.Bass',
};
const lookup = (id: string) => NAMES[id];

type PerformanceSnapshotOverride = Partial<Omit<PerformanceSnapshot, 'voiceModeSnapshot'>> & {
  voiceModeSnapshot?: Partial<PerformanceSnapshot['voiceModeSnapshot']>;
};

function snapshot(over: PerformanceSnapshotOverride): PerformanceSnapshot {
  return {
    ...DEFAULT_PERFORMANCE_SNAPSHOT,
    ...over,
    voiceModeSnapshot: {
      ...DEFAULT_PERFORMANCE_SNAPSHOT.voiceModeSnapshot,
      ...(over.voiceModeSnapshot ?? {}),
    },
  };
}

describe('noteName', () => {
  it('names middle C as C4', () => {
    expect(noteName(60)).toBe('C4');
  });

  it('names the F#3 split point keyboards default to', () => {
    expect(noteName(54)).toBe('F#3');
  });

  it('names the bottom of the keyboard', () => {
    expect(noteName(21)).toBe('A0');
  });
});

describe('summariseScene', () => {
  it('renders a single tone with no role glyph', () => {
    const s = summariseScene(
      snapshot({voiceModeSnapshot: {voiceMode: 'single', rightToneId: 'a'}}),
      lookup,
    );
    expect(s.modeLabel).toBe('SINGLE');
    expect(s.tones).toEqual([{role: 'single', glyph: '', name: 'Concert Piano'}]);
    expect(s.splitPoint).toBeNull();
  });

  it('renders dual as two upper tones', () => {
    const s = summariseScene(
      snapshot({
        voiceModeSnapshot: {voiceMode: 'dual', rightToneId: 'a', dualTone2Id: 'b'},
      }),
      lookup,
    );
    expect(s.modeLabel).toBe('DUAL');
    expect(s.tones).toEqual([
      {role: 'upper', glyph: '▸', name: 'Concert Piano'},
      {role: 'upper', glyph: '▸', name: 'Strings'},
    ]);
    expect(s.splitPoint).toBeNull();
  });

  it('renders twin as a single tone with no split point', () => {
    const s = summariseScene(
      snapshot({voiceModeSnapshot: {voiceMode: 'twin', rightToneId: 'a'}}),
      lookup,
    );
    expect(s.modeLabel).toBe('TWIN');
    expect(s.tones).toEqual([{role: 'single', glyph: '', name: 'Concert Piano'}]);
    expect(s.splitPoint).toBeNull();
  });

  it('renders split with roles and a named split point', () => {
    const s = summariseScene(
      snapshot({
        voiceModeSnapshot: {
          voiceMode: 'split',
          rightToneId: 'a',
          leftToneId: 'c',
          splitPoint: 54,
        },
      }),
      lookup,
    );
    expect(s.modeLabel).toBe('SPLIT');
    expect(s.tones).toEqual([
      {role: 'upper', glyph: '▸', name: 'Concert Piano'},
      {role: 'lower', glyph: '◂', name: 'E.Bass'},
    ]);
    expect(s.splitPoint).toBe('F#3');
  });

  it('omits the split point when split mode carries no splitPoint', () => {
    const s = summariseScene(
      snapshot({
        voiceModeSnapshot: {voiceMode: 'split', rightToneId: 'a', leftToneId: 'c'},
      }),
      lookup,
    );
    expect(s.splitPoint).toBeNull();
  });

  it('falls back to a dash for an unknown tone id', () => {
    const s = summariseScene(
      snapshot({voiceModeSnapshot: {voiceMode: 'single', rightToneId: 'zzz'}}),
      lookup,
    );
    expect(s.tones[0].name).toBe('—');
  });

  it('carries tempo and volume through', () => {
    const s = summariseScene(snapshot({tempo: 96, volume: 80}), lookup);
    expect(s.tempo).toBe(96);
    expect(s.volume).toBe(80);
  });
});
