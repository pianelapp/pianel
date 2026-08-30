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

const saved: string[] = [];

function build(content: string | null) {
  const pianoService = new PianoService(new FakeTransport());
  pianoService.setEngine(new FP30XEngine());
  const presetService = new PresetService(pianoService);
  const picker: FilePickerAdapter = {
    async openProfileJson() {
      return content;
    },
    async saveProfileJson(_name: string, contents: string) {
      saved.push(contents);
      return true;
    },
  };
  return new ProfileService(pianoService, picker, presetService);
}

function v2File() {
  const now = new Date().toISOString();
  return JSON.stringify({
    schemaVersion: 2,
    exportedAt: now,
    profile: {
      id: '1234567890-abcdefgh',
      name: 'Old Rig',
      schemaVersion: 2,
      theme: 'system',
      accidentals: 'sharps',
      favorites: [],
      presets: [
        {
          id: '1234567890-aaaaaaaa',
          label: 'Warm',
          tilePosition: 0,
          snapshot: {volume: 70, tempo: 90, metronome: {}},
          createdAt: now,
          updatedAt: now,
        },
      ],
      songs: [],
      setlists: [],
      defaultState: {volume: 100, tempo: 120, metronome: {}},
      createdAt: now,
      updatedAt: now,
    },
  });
}

beforeAll(() => {
  createProfilesStore({storage: inMemoryStorage});
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
  createFavoritesStore({storage: inMemoryStorage});
  createConnectionStore({storage: inMemoryStorage});
});

beforeEach(() => {
  saved.length = 0;
  useProfilesStore.setState({profiles: [], activeProfileId: ''});
  usePerformanceStore.setState({keyTouch: undefined});
});

describe('v2 profile re-saved from a v3 build', () => {
  it('stamps v3 on import even before anything is edited', async () => {
    const service = build(v2File());
    await service.importProfile();
    const stored = useProfilesStore.getState().profiles[0];
    expect(stored.schemaVersion).toBe(3);
    expect(stored.defaultState.keyTouch).toBeUndefined();
  });

  it('writes schemaVersion 3 and no keyTouch key when the piano never reported a curve', async () => {
    const service = build(v2File());
    await service.importProfile();
    const stored = useProfilesStore.getState().profiles[0];

    await service.exportProfile(stored.id);
    const file = JSON.parse(saved[0]);

    expect(file.schemaVersion).toBe(3);
    expect('keyTouch' in file.profile.defaultState).toBe(false);
    expect('keyTouch' in file.profile.presets[0].snapshot).toBe(false);
  });

  it('records the curve once the piano has reported it and the state is recaptured', async () => {
    const service = build(v2File());
    await service.importProfile();
    const stored = useProfilesStore.getState().profiles[0];

    usePerformanceStore.getState().setKeyTouch(4);
    await service.updateProfile(stored.id);

    await service.exportProfile(stored.id);
    const file = JSON.parse(saved[0]);

    expect(file.schemaVersion).toBe(3);
    expect(file.profile.defaultState.keyTouch).toBe(4);
  });

  it('leaves an untouched old preset without a curve', async () => {
    const service = build(v2File());
    await service.importProfile();
    const stored = useProfilesStore.getState().profiles[0];

    usePerformanceStore.getState().setKeyTouch(4);
    await service.updateProfile(stored.id);

    await service.exportProfile(stored.id);
    const file = JSON.parse(saved[0]);

    expect('keyTouch' in file.profile.presets[0].snapshot).toBe(false);
  });
});
