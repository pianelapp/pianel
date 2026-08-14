import {ProfileService} from '../../../src/services/profiles/ProfileService';
import {PresetService} from '../../../src/services/presets/PresetService';
import {PianoService} from '../../../src/services/PianoService';
import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {
  createProfilesStore,
  useProfilesStore,
} from '../../../src/store/profilesStore';
import {createPerformanceStore} from '../../../src/store/performanceStore';
import {createAppSettingsStore} from '../../../src/store/appSettingsStore';
import {createFavoritesStore} from '../../../src/store/favoritesStore';
import {createConnectionStore} from '../../../src/store/connectionStore';
import {inMemoryStorage} from '../../../src/store/storage';
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

const fakePicker: FilePickerAdapter = {
  async openProfileJson() {
    return null;
  },
  async saveProfileJson() {
    return false;
  },
};

function newProfileService(): ProfileService {
  const transport = new FakeTransport();
  const pianoService = new PianoService(transport);
  pianoService.setEngine(new FP30XEngine());
  return new ProfileService(
    pianoService,
    fakePicker,
    new PresetService(pianoService),
  );
}

function watchForDanglingActiveId(): {
  violations: string[];
  stop: () => void;
} {
  const violations: string[] = [];
  const stop = useProfilesStore.subscribe(state => {
    const {activeProfileId, profiles} = state;
    if (
      activeProfileId !== '' &&
      !profiles.some(p => p.id === activeProfileId)
    ) {
      violations.push(activeProfileId);
    }
  });
  return {violations, stop};
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

describe('deleteProfile keeps activeProfileId resolvable', () => {
  it('never publishes a dangling id when another profile remains', async () => {
    const service = newProfileService();
    await service.createProfile('Alpha');
    const beta = await service.createProfile('Beta');

    const watch = watchForDanglingActiveId();
    await service.deleteProfile(beta.id);
    watch.stop();

    expect(watch.violations).toEqual([]);
  });

  it('never publishes a dangling id when deleting the last profile', async () => {
    const service = newProfileService();
    const only = await service.createProfile('Only');

    const watch = watchForDanglingActiveId();
    const {newActiveProfileId} = await service.deleteProfile(only.id);
    watch.stop();

    expect(watch.violations).toEqual([]);
    expect(newActiveProfileId).not.toBe(only.id);
  });

  it('never publishes an empty profile list when deleting the last profile', async () => {
    const service = newProfileService();
    const only = await service.createProfile('Only');

    const empties: number[] = [];
    const stop = useProfilesStore.subscribe(state => {
      if (state.profiles.length === 0) empties.push(0);
    });
    await service.deleteProfile(only.id);
    stop();

    expect(empties).toEqual([]);
  });

  it('still lands on the most-recently-updated survivor', async () => {
    const service = newProfileService();
    const alpha = await service.createProfile('Alpha');
    const beta = await service.createProfile('Beta');

    const {newActiveProfileId} = await service.deleteProfile(beta.id);

    expect(newActiveProfileId).toBe(alpha.id);
    expect(useProfilesStore.getState().activeProfileId).toBe(alpha.id);
    expect(useProfilesStore.getState().profiles.map(p => p.id)).toEqual([
      alpha.id,
    ]);
  });

  it('leaves activeProfileId alone when deleting a non-active profile', async () => {
    const service = newProfileService();
    const alpha = await service.createProfile('Alpha');
    const beta = await service.createProfile('Beta');

    const watch = watchForDanglingActiveId();
    await service.deleteProfile(alpha.id);
    watch.stop();

    expect(watch.violations).toEqual([]);
    expect(useProfilesStore.getState().activeProfileId).toBe(beta.id);
  });
});
