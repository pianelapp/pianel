import {applyExportFileDefaults} from '../../../src/services/profiles/ProfileService';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import type {ProfileExportFile} from '../../../src/types/profile';
import {CURRENT_SCHEMA_VERSION} from '../../../src/types/schemaVersion';

function minimalExport(): ProfileExportFile {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: '2026-01-01T00:00:00Z',
    profile: {
      id: '1234567890-abcdefgh',
      name: 'Test',
      schemaVersion: CURRENT_SCHEMA_VERSION,
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
    } as unknown as ProfileExportFile['profile']['defaultState'];
    const filled = applyExportFileDefaults(partial);
    expect(filled.profile.defaultState.volume).toBe(50);
    expect(filled.profile.defaultState.tempo).toBe(120);
  });

  it('passes presets through with their own per-field defaults', () => {
    const withPreset = minimalExport();
    withPreset.profile.presets = [
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
