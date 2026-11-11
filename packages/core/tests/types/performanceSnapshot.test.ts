/**
 * T006 — PerformanceSnapshot shape + defaults table tests (data-model.md §4/§9).
 *
 * Verifies the documented defaults that the forward-compat loader (T082) uses
 * to fill in missing optional fields per FR-010 / FR-023 / SC-008.
 */

import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../src/types/performanceSnapshot';
import type {PerformanceSnapshot} from '../../src/types/performanceSnapshot';
import {CURRENT_SCHEMA_VERSION} from '../../src/types/schemaVersion';
import {SCHEMA_HISTORY} from '../../src/helpers/schemaHistory';
import {readFileSync} from 'fs';
import {join} from 'path';

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

describe('PerformanceSnapshot.volume as the Engine Volume position', () => {
  const source = readFileSync(
    join(__dirname, '../../src/types/performanceSnapshot.ts'),
    'utf8',
  );
  const volumeDoc = (): string => {
    const match = source.match(/\/\*\*([^]*?)\*\/\s*volume: number;/);
    return match ? match[1] : '';
  };

  it('keeps the field named volume with a numeric type', () => {
    expect(source).toMatch(/\n  volume: number;/);
    expect(source).not.toMatch(/engineVolume/);
  });

  it('documents the field as the Engine Volume fader position sent as Universal Realtime Master Volume', () => {
    const doc = volumeDoc();
    expect(doc).toMatch(/Engine Volume/);
    expect(doc).toMatch(/Universal Realtime Master Volume/);
    expect(doc).toMatch(/0-100/);
    expect(doc).not.toMatch(/01 00 02 13/);
  });

  it('does not bump the profile schema version or add a history entry', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
    expect(SCHEMA_HISTORY[SCHEMA_HISTORY.length - 1].version).toBe(3);
    expect(SCHEMA_HISTORY).toHaveLength(3);
  });
});
