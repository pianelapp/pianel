/**
 * T064 — ProfileService export tests (US3).
 *
 * Covers:
 *  - exportProfile serializes to ProfileExportFile JSON (schemaVersion 1).
 *  - Filename is `<sanitized-name>.pianel-profile.json`.
 *  - Resolves `{saved: true}` when the adapter writes; `{saved: false}` when
 *    the user cancels the dialog.
 */

import {ProfileService} from '../../../src/services/profiles/ProfileService';
import {PresetService} from '../../../src/services/presets/PresetService';
import {PianoService} from '../../../src/services/PianoService';
import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {createProfilesStore, useProfilesStore} from '../../../src/store/profilesStore';
import {createPerformanceStore} from '../../../src/store/performanceStore';
import {createAppSettingsStore} from '../../../src/store/appSettingsStore';
import {createFavoritesStore} from '../../../src/store/favoritesStore';
import {createConnectionStore} from '../../../src/store/connectionStore';
import {inMemoryStorage} from '../../../src/store/storage';
import {ProfileNotFoundError} from '../../../src/types/profile';
import type {ProfileExportFile} from '../../../src/types/profile';
import type {Transport} from '../../../src/transport/types';
import type {FilePickerAdapter} from '../../../src/services/profiles/FilePickerAdapter';

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

function buildPicker(saved: boolean) {
  const saveCalls: Array<{filename: string; contents: string}> = [];
  const picker: FilePickerAdapter = {
    async openProfileJson() {
      return null;
    },
    async saveProfileJson(filename, contents) {
      saveCalls.push({filename, contents});
      return saved;
    },
  };
  return {picker, saveCalls};
}

function buildService(picker: FilePickerAdapter): ProfileService {
  const transport = new FakeTransport();
  const pianoService = new PianoService(transport);
  pianoService.setEngine(new FP30XEngine());
  const presetService = new PresetService(pianoService);
  return new ProfileService(pianoService, picker, presetService);
}

beforeAll(() => {
  createProfilesStore({storage: inMemoryStorage});
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
  createFavoritesStore({storage: inMemoryStorage});
  createConnectionStore({storage: inMemoryStorage});
});

beforeEach(() => {
  useProfilesStore.setState({profiles: [], activeProfileId: ''});
});

describe('ProfileService.exportProfile', () => {
  it('serializes to ProfileExportFile shape with schemaVersion 1', async () => {
    const {picker, saveCalls} = buildPicker(true);
    const service = buildService(picker);
    const profile = await service.createProfile('Alpha');

    const result = await service.exportProfile(profile.id);
    expect(result.saved).toBe(true);
    expect(saveCalls).toHaveLength(1);

    const file = JSON.parse(saveCalls[0].contents) as ProfileExportFile;
    expect(file.schemaVersion).toBe(1);
    expect(file.profile.id).toBe(profile.id);
    expect(file.profile.name).toBe('Alpha');
    expect(typeof file.exportedAt).toBe('string');
  });

  it('produces a `<name>.pianel-profile.json` filename', async () => {
    const {picker, saveCalls} = buildPicker(true);
    const service = buildService(picker);
    const profile = await service.createProfile('My Setup');
    await service.exportProfile(profile.id);
    expect(saveCalls[0].filename).toBe('My Setup.pianel-profile.json');
  });

  it('sanitizes filesystem-illegal characters in the filename', async () => {
    const {picker, saveCalls} = buildPicker(true);
    const service = buildService(picker);
    const profile = await service.createProfile('Live/Set:1');
    await service.exportProfile(profile.id);
    expect(saveCalls[0].filename).toBe('LiveSet1.pianel-profile.json');
  });

  it('returns saved=false when the user cancels the dialog', async () => {
    const {picker} = buildPicker(false);
    const service = buildService(picker);
    const profile = await service.createProfile('Alpha');
    const result = await service.exportProfile(profile.id);
    expect(result.saved).toBe(false);
  });

  it('throws ProfileNotFoundError when id does not exist', async () => {
    const {picker} = buildPicker(true);
    const service = buildService(picker);
    await expect(service.exportProfile('ghost')).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
  });
});
