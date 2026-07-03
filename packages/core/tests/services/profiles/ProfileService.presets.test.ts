/**
 * T020 — ProfileService preset-grid operation tests (US1).
 *
 * Covers:
 *  - `savePresetToTile` happy path + `PresetGridFullError` when tile occupied.
 *  - `applyPreset` resolves a preset by id and delegates to PresetService.
 *  - `updatePreset` re-captures snapshot + optional label change.
 *  - `renamePreset` updates only label (snapshot untouched per SC-009).
 *  - `deletePreset` empties the tile.
 *
 * Uses a real PresetService backed by a fake transport so capture/apply work
 * end-to-end, and a mock FilePickerAdapter (unused in this story).
 */

import {ProfileService} from '../../../src/services/profiles/ProfileService';
import {PresetService} from '../../../src/services/presets/PresetService';
import {PianoService} from '../../../src/services/PianoService';
import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {createProfilesStore, useProfilesStore} from '../../../src/store/profilesStore';
import {createPerformanceStore, usePerformanceStore} from '../../../src/store/performanceStore';
import {createAppSettingsStore} from '../../../src/store/appSettingsStore';
import {createFavoritesStore} from '../../../src/store/favoritesStore';
import {createConnectionStore} from '../../../src/store/connectionStore';
import {inMemoryStorage} from '../../../src/store/storage';
import {PresetGridFullError} from '../../../src/types/profile';
import type {Transport} from '../../../src/transport/types';
import type {FilePickerAdapter} from '../../../src/services/profiles/FilePickerAdapter';

// ─── Fakes ──────────────────────────────────────────────────────

class FakeTransport implements Transport {
  status: 'idle' | 'connected' | 'disconnected' = 'idle';
  deviceName: string | null = null;
  async scan(): Promise<void> {}
  async stopScan(): Promise<void> {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async destroy(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
  async send(): Promise<void> {}
}

const fakePicker: FilePickerAdapter = {
  async openProfileJson() {
    return null;
  },
  async saveProfileJson() {
    return false;
  },
};

async function newProfileService(): Promise<ProfileService> {
  const transport = new FakeTransport();
  const pianoService = new PianoService(transport);
  pianoService.setEngine(new FP30XEngine());
  const presetService = new PresetService(pianoService);
  const profileService = new ProfileService(
    pianoService,
    fakePicker,
    presetService,
  );
  await profileService.ensureDefaultProfile();
  return profileService;
}

beforeAll(() => {
  createProfilesStore({storage: inMemoryStorage});
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
  createFavoritesStore({storage: inMemoryStorage});
  createConnectionStore({storage: inMemoryStorage});
});

beforeEach(async () => {
  useProfilesStore.setState({profiles: [], activeProfileId: ''});
  usePerformanceStore.getState().resetPerformance();
});

// ─── savePresetToTile ───────────────────────────────────────────

describe('ProfileService.savePresetToTile', () => {
  it('saves a preset to an empty tile and appends to active profile', async () => {
    const service = await newProfileService();
    const preset = await service.savePresetToTile(3, 'Verse');
    expect(preset.tilePosition).toBe(3);
    expect(preset.label).toBe('Verse');
    const active = service.getActiveProfile()!;
    expect(active.presets).toHaveLength(1);
    expect(active.presets[0].id).toBe(preset.id);
  });

  it('throws PresetGridFullError when tile already occupied', async () => {
    const service = await newProfileService();
    await service.savePresetToTile(3, 'Verse');
    await expect(service.savePresetToTile(3, 'Chorus')).rejects.toBeInstanceOf(
      PresetGridFullError,
    );
  });

  it('rejects empty / whitespace label', async () => {
    const service = await newProfileService();
    await expect(service.savePresetToTile(0, '   ')).rejects.toThrow();
  });

  it('rejects tilePosition outside [0, 7]', async () => {
    const service = await newProfileService();
    await expect(service.savePresetToTile(8, 'X')).rejects.toThrow();
    await expect(service.savePresetToTile(-1, 'X')).rejects.toThrow();
  });
});

// ─── applyPreset ────────────────────────────────────────────────

describe('ProfileService.applyPreset', () => {
  it('applies a preset that exists in the active profile', async () => {
    const service = await newProfileService();
    const preset = await service.savePresetToTile(0, 'Test');
    await service.applyPreset(preset.id);
    expect(usePerformanceStore.getState().activePresetId).toBe(preset.id);
  });

  it('throws when no preset matches', async () => {
    const service = await newProfileService();
    await expect(service.applyPreset('not-a-real-id')).rejects.toThrow();
  });
});

// ─── updatePreset ───────────────────────────────────────────────

describe('ProfileService.updatePreset', () => {
  it('re-captures snapshot and optionally updates label', async () => {
    const service = await newProfileService();
    const preset = await service.savePresetToTile(0, 'Old');
    usePerformanceStore.getState().setVolume(42);

    const updated = await service.updatePreset(preset.id, {label: 'New'});
    expect(updated.label).toBe('New');
    expect(updated.snapshot.volume).toBe(42);
    expect(updated.updatedAt >= preset.updatedAt).toBe(true);
  });

  it('preserves label when not supplied', async () => {
    const service = await newProfileService();
    const preset = await service.savePresetToTile(0, 'Keep');
    const updated = await service.updatePreset(preset.id);
    expect(updated.label).toBe('Keep');
  });
});

// ─── renamePreset (snapshot untouched, SC-009) ─────────────────

describe('ProfileService.renamePreset', () => {
  it('changes only label + updatedAt; snapshot untouched (SC-009)', async () => {
    const service = await newProfileService();
    const preset = await service.savePresetToTile(0, 'Before');
    // Mutate performance state so a re-capture WOULD differ.
    usePerformanceStore.getState().setVolume(33);
    const renamed = await service.renamePreset(preset.id, 'After');
    expect(renamed.label).toBe('After');
    expect(renamed.snapshot).toEqual(preset.snapshot);
  });

  it('rejects empty / whitespace label', async () => {
    const service = await newProfileService();
    const preset = await service.savePresetToTile(0, 'X');
    await expect(service.renamePreset(preset.id, '   ')).rejects.toThrow();
  });
});

// ─── deletePreset ───────────────────────────────────────────────

describe('ProfileService.deletePreset', () => {
  it('removes the preset and frees the tile', async () => {
    const service = await newProfileService();
    const preset = await service.savePresetToTile(2, 'X');
    await service.deletePreset(preset.id);
    expect(service.getActiveProfile()!.presets).toHaveLength(0);
    // Tile 2 should now be re-savable.
    await expect(
      service.savePresetToTile(2, 'Replacement'),
    ).resolves.toBeTruthy();
  });

  it('throws when preset does not exist', async () => {
    const service = await newProfileService();
    await expect(service.deletePreset('ghost')).rejects.toThrow();
  });
});
