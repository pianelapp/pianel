/**
 * Task 3.3 — integration test for web ProfileService + file-picker wiring.
 *
 * Proves:
 *  - the web `FilePickerAdapter`, injected via `createWebProfileService`,
 *    round-trips a profile (export then import → imported), going through the
 *    real `webFilePicker` File System Access path (mocked FSA handles);
 *  - a malformed / unsupported-version file surfaces the existing core
 *    validation error without corrupting stored data.
 */
import { PianoService } from '@pianel/core/services/PianoService';
import { PresetService } from '@pianel/core/services/presets/PresetService';
import { FP30XEngine } from '@pianel/core/engine/fp30x/FP30XEngine';
import {
  createProfilesStore,
  useProfilesStore,
  createPerformanceStore,
  createAppSettingsStore,
  createFavoritesStore,
  createConnectionStore,
  inMemoryStorage,
  UnsupportedProfileVersionError,
  MalformedProfileFileError,
} from '@pianel/core/store';
import type { Transport } from '@pianel/core/transport/types';
import { createWebProfileService } from '../src/services/profileService.web';

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

/**
 * In-memory File System Access stand-in: `showSaveFilePicker` captures written
 * contents; `showOpenFilePicker` replays whatever was last written (or an
 * override). This drives the *real* webFilePicker FSA branch.
 */
function installFakeFsa() {
  const state: { lastWritten: string | null; openOverride: string | null } = {
    lastWritten: null,
    openOverride: null,
  };
  (window as unknown as Record<string, unknown>).showSaveFilePicker = async () => ({
    createWritable: async () => ({
      write: async (data: string) => {
        state.lastWritten = data;
      },
      close: async () => {},
    }),
  });
  (window as unknown as Record<string, unknown>).showOpenFilePicker = async () => {
    const contents = state.openOverride ?? state.lastWritten ?? '';
    return [
      {
        getFile: async () => ({ text: async () => contents }),
      },
    ];
  };
  return state;
}

beforeAll(() => {
  createProfilesStore({ storage: inMemoryStorage });
  createPerformanceStore({ storage: inMemoryStorage });
  createAppSettingsStore({ storage: inMemoryStorage });
  createFavoritesStore({ storage: inMemoryStorage });
  createConnectionStore({ storage: inMemoryStorage });
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
  delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
});

function buildService() {
  const pianoService = new PianoService(new FakeTransport());
  pianoService.setEngine(new FP30XEngine());
  const presetService = new PresetService(pianoService);
  return createWebProfileService(pianoService, presetService);
}

describe('web ProfileService + webFilePicker wiring', () => {
  it('round-trips a profile through export then import', async () => {
    const fsa = installFakeFsa();
    const service = buildService();

    const created = await service.createProfile('Round Trip Profile');
    const { saved } = await service.exportProfile(created.id);
    expect(saved).toBe(true);
    expect(fsa.lastWritten).not.toBeNull();

    // Remove it so re-import is a fresh add, not a conflict.
    useProfilesStore.getState().removeProfile(created.id);
    expect(useProfilesStore.getState().profiles.some((p) => p.id === created.id)).toBe(false);

    const result = await service.importProfile();
    expect(result.kind).toBe('imported');
    if (result.kind === 'imported') {
      expect(result.profile.name).toBe('Round Trip Profile');
    }
    expect(useProfilesStore.getState().profiles.some((p) => p.name === 'Round Trip Profile')).toBe(true);
  });

  it('surfaces the core unsupported-version error and leaves stored data unchanged', async () => {
    const fsa = installFakeFsa();
    const service = buildService();
    fsa.openOverride = JSON.stringify({ schemaVersion: 9999, profile: { id: 'x', name: 'Y' } });

    const before = useProfilesStore.getState().profiles.length;
    await expect(service.importProfile()).rejects.toBeInstanceOf(UnsupportedProfileVersionError);
    expect(useProfilesStore.getState().profiles.length).toBe(before);
  });

  it('surfaces the core malformed-file error for invalid JSON without corrupting data', async () => {
    const fsa = installFakeFsa();
    const service = buildService();
    fsa.openOverride = 'this is not json {';

    const before = useProfilesStore.getState().profiles.length;
    await expect(service.importProfile()).rejects.toBeInstanceOf(MalformedProfileFileError);
    expect(useProfilesStore.getState().profiles.length).toBe(before);
  });
});
