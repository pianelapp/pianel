/**
 * T006 — PerformanceSnapshot shape + defaults table tests (data-model.md §4/§9).
 *
 * Verifies the documented defaults that the forward-compat loader (T082) uses
 * to fill in missing optional fields per FR-010 / FR-023 / SC-008.
 */

import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../src/types/performanceSnapshot';
import type {PerformanceSnapshot} from '../../src/types/performanceSnapshot';

describe('PerformanceSnapshot shape', () => {
  it('has every required field per data-model §4', () => {
    const snap: PerformanceSnapshot = DEFAULT_PERFORMANCE_SNAPSHOT;
    // Spot-check at the value level — TypeScript already enforces shape.
    expect(typeof snap.volume).toBe('number');
    expect(typeof snap.tempo).toBe('number');
    expect(typeof snap.metronome).toBe('object');
    expect(typeof snap.voiceModeSnapshot).toBe('object');
    expect('currentToneId' in snap).toBe(true);
    expect(Array.isArray(snap.quickToneSlots)).toBe(true);
    expect(snap.quickToneSlots).toHaveLength(3);
  });
});

describe('DEFAULT_PERFORMANCE_SNAPSHOT (defaults table — data-model §9)', () => {
  it('volume default is 100', () => {
    expect(DEFAULT_PERFORMANCE_SNAPSHOT.volume).toBe(100);
  });

  it('tempo default is 120', () => {
    expect(DEFAULT_PERFORMANCE_SNAPSHOT.tempo).toBe(120);
  });

  it('metronome is an empty object (all sub-fields ⇒ "no change")', () => {
    expect(DEFAULT_PERFORMANCE_SNAPSHOT.metronome).toEqual({});
  });

  it('currentToneId defaults to null (no tone write on apply)', () => {
    expect(DEFAULT_PERFORMANCE_SNAPSHOT.currentToneId).toBeNull();
  });

  it('voiceModeSnapshot defaults to safe Single-mode fallback', () => {
    expect(DEFAULT_PERFORMANCE_SNAPSHOT.voiceModeSnapshot).toEqual({
      voiceMode: 'single',
      rightToneId: null,
      leftToneId: null,
      dualTone2Id: null,
    });
  });

  it('quickToneSlots defaults to [null, null, null]', () => {
    expect(DEFAULT_PERFORMANCE_SNAPSHOT.quickToneSlots).toEqual([
      null,
      null,
      null,
    ]);
  });
});
