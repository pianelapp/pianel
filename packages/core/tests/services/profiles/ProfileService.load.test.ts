/**
 * T041 — ProfileService.loadProfile tests (US2).
 *
 * Covers:
 *  - loadProfile writes theme/accidentals/favorites/quick-tone slots to UI
 *    stores synchronously.
 *  - loadProfile does NOT touch the piano in any connection state — profile
 *    apply is purely an app-config swap, never an audible action.
 */

import {ProfileService} from '../../../src/services/profiles/ProfileService';
import {PresetService} from '../../../src/services/presets/PresetService';
import {PianoService} from '../../../src/services/PianoService';
import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {createProfilesStore, useProfilesStore} from '../../../src/store/profilesStore';
import {createPerformanceStore} from '../../../src/store/performanceStore';
import {createAppSettingsStore, useAppSettingsStore} from '../../../src/store/appSettingsStore';
import {createFavoritesStore, useFavoritesStore} from '../../../src/store/favoritesStore';
import {createConnectionStore, useConnectionStore} from '../../../src/store/connectionStore';
import {inMemoryStorage} from '../../../src/store/storage';
import {ProfileNotFoundError} from '../../../src/types/profile';
import type {Transport} from '../../../src/transport/types';
import type {FilePickerAdapter} from '../../../src/services/profiles/FilePickerAdapter';

class FakeTransport implements Transport {
  status: 'idle' | 'connected' | 'disconnected' = 'idle';
  deviceName: string | null = null;
  sentMessages: number[][] = [];
  async scan(): Promise<void> {}
  async stopScan(): Promise<void> {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async destroy(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
  async send(bytes: number[]): Promise<void> {
    this.sentMessages.push([...bytes]);
  }
}

const fakePicker: FilePickerAdapter = {
  async openProfileJson() {
    return null;
  },
  async saveProfileJson() {
    return false;
  },
};

function buildService(): {
  service: ProfileService;
  transport: FakeTransport;
} {
  const transport = new FakeTransport();
  const pianoService = new PianoService(transport);
  pianoService.setEngine(new FP30XEngine());
  const presetService = new PresetService(pianoService);
  const service = new ProfileService(pianoService, fakePicker, presetService);
  return {service, transport};
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
  useFavoritesStore.setState({favorites: []});
  useConnectionStore.getState().reset();
});

describe('ProfileService.loadProfile', () => {
  it('writes theme + accidentals + favorites to their stores synchronously', async () => {
    const {service} = buildService();
    await service.ensureDefaultProfile();
    const a = await service.createProfile('Alpha');
    // Set distinct values on Alpha then switch back to Default.
    useAppSettingsStore.getState().setThemePreference('dark');
    useAppSettingsStore.getState().setAccidentalPreference('flats');
    useFavoritesStore.getState().addFavorite('0-0-1');
    await service.updateProfile(a.id);

    // Mutate live state, then load Alpha back.
    useAppSettingsStore.getState().setThemePreference('light');
    useAppSettingsStore.getState().setAccidentalPreference('sharps');
    useFavoritesStore.getState().removeFavorite('0-0-1');

    await service.loadProfile(a.id);
    expect(useAppSettingsStore.getState().themePreference).toBe('dark');
    expect(useAppSettingsStore.getState().accidentalPreference).toBe('flats');
    expect(useFavoritesStore.getState().favorites.map(f => f.toneId)).toEqual([
      '0-0-1',
    ]);
  });

  it('switches activeProfileId in profilesStore', async () => {
    const {service} = buildService();
    const a = await service.createProfile('Alpha');
    const b = await service.createProfile('Beta');
    await service.loadProfile(a.id);
    expect(useProfilesStore.getState().activeProfileId).toBe(a.id);
    await service.loadProfile(b.id);
    expect(useProfilesStore.getState().activeProfileId).toBe(b.id);
  });

  it('throws ProfileNotFoundError when id does not exist', async () => {
    const {service} = buildService();
    await expect(service.loadProfile('ghost')).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
  });

  it('does not send any DT1 writes when the piano is disconnected', async () => {
    const {service, transport} = buildService();
    const a = await service.createProfile('Alpha');
    expect(useConnectionStore.getState().status).not.toBe('connected');
    await service.loadProfile(a.id);
    expect(transport.sentMessages).toHaveLength(0);
  });

  it('does not send any DT1 writes even when the piano is connected', async () => {
    const {service, transport} = buildService();
    const a = await service.createProfile('Alpha');
    useConnectionStore.getState().setConnecting();
    useConnectionStore.getState().setConnected();
    await service.loadProfile(a.id);
    expect(transport.sentMessages).toHaveLength(0);
  });

  it('restores quick-tone slot assignments from profile.defaultState', async () => {
    const {service} = buildService();
    const a = await service.createProfile('Alpha');
    // Set distinct slots and save them into Alpha's snapshot.
    useAppSettingsStore.getState().setQuickToneSlot(0, {
      voiceMode: 'single',
      rightToneId: '0-0-1',
      leftToneId: null,
      dualTone2Id: null,
    });
    await service.updateProfile(a.id);

    // Wipe the live slots, then re-load Alpha.
    useAppSettingsStore.getState().setQuickToneSlot(0, null);
    expect(useAppSettingsStore.getState().quickToneSlots[0]).toBeNull();

    await service.loadProfile(a.id);
    expect(useAppSettingsStore.getState().quickToneSlots[0]).toEqual({
      voiceMode: 'single',
      rightToneId: '0-0-1',
      leftToneId: null,
      dualTone2Id: null,
    });
  });
});
