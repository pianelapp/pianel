/**
 * T080 — Forward-compatibility tests (US4).
 *
 * Covers the documented per-field defaults (data-model.md §9) that the loader
 * applies when an imported file is missing one or more snapshot fields per
 * FR-010 / FR-023 / SC-008. Loader never aborts on missing optional fields.
 */

import {applyExportFileDefaults} from '../../../src/services/profiles/ProfileService';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import type {ProfileExportFile} from '../../../src/types/profile';

function minimalExport(): ProfileExportFile {
  // Build a parsed-export-file with the bare-minimum fields the validator
  // accepts. The loader fills in everything else.
  return {
    schemaVersion: 1,
    exportedAt: '2026-01-01T00:00:00Z',
    profile: {
      id: '1234567890-abcdefgh',
      name: 'Test',
      schemaVersion: 1,
      // omit theme, accidentals, favorites, presets, defaultState
      // (and createdAt/updatedAt) to verify defaults kick in.
    } as ProfileExportFile['profile'],
  };
}

describe('applyExportFileDefaults', () => {
  it('fills in theme/accidentals/favorites/presets when missing', () => {
    const filled = applyExportFileDefaults(minimalExport());
    expect(filled.profile.theme).toBe('system');
    expect(filled.profile.accidentals).toBe('sharps');
    expect(filled.profile.favorites).toEqual([]);
    expect(filled.profile.presets).toEqual([]);
  });

  it('fills in defaultState from DEFAULT_PERFORMANCE_SNAPSHOT', () => {
    const filled = applyExportFileDefaults(minimalExport());
    expect(filled.profile.defaultState.volume).toBe(
      DEFAULT_PERFORMANCE_SNAPSHOT.volume,
    );
    expect(filled.profile.defaultState.tempo).toBe(
      DEFAULT_PERFORMANCE_SNAPSHOT.tempo,
    );
    expect(filled.profile.defaultState.metronome).toEqual({});
    expect(filled.profile.defaultState.quickToneSlots).toEqual([
      null,
      null,
      null,
    ]);
    expect(filled.profile.defaultState.currentToneId).toBeNull();
  });

  it('preserves a partial defaultState and fills in only missing keys', () => {
    const partial = minimalExport();
    partial.profile.defaultState = {
      volume: 50,
      // tempo missing — should default to 120
    } as unknown as ProfileExportFile['profile']['defaultState'];
    const filled = applyExportFileDefaults(partial);
    expect(filled.profile.defaultState.volume).toBe(50);
    expect(filled.profile.defaultState.tempo).toBe(120);
  });

  it('passes presets through with their own per-field defaults', () => {
    const withPreset = minimalExport();
    withPreset.profile.presets = [
      // missing label, snapshot, timestamps — defaults should fill them in
      {
        id: '1234567890-aaaaaaaa',
        tilePosition: 2,
      } as unknown as ProfileExportFile['profile']['presets'][number],
    ];
    const filled = applyExportFileDefaults(withPreset);
    expect(filled.profile.presets).toHaveLength(1);
    expect(filled.profile.presets[0].label).toBe('Untitled');
    expect(filled.profile.presets[0].tilePosition).toBe(2);
    expect(filled.profile.presets[0].snapshot.volume).toBe(100);
  });

  it('fills in createdAt / updatedAt when missing', () => {
    const filled = applyExportFileDefaults(minimalExport());
    expect(typeof filled.profile.createdAt).toBe('string');
    expect(typeof filled.profile.updatedAt).toBe('string');
  });
});
