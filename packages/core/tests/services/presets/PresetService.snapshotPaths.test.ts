import {ProfileService} from '../../../src/services/profiles/ProfileService';
import {SongService} from '../../../src/services/songs/SongService';
import {SetlistService} from '../../../src/services/setlists/SetlistService';
import {SetlistCursorService} from '../../../src/services/cursor/SetlistCursorService';
import {
  createConnectionStore,
  useConnectionStore,
} from '../../../src/store/connectionStore';
import {
  createPerformanceStore,
  usePerformanceStore,
} from '../../../src/store/performanceStore';
import {createAppSettingsStore} from '../../../src/store/appSettingsStore';
import {
  createProfilesStore,
  useProfilesStore,
} from '../../../src/store/profilesStore';
import {createFavoritesStore} from '../../../src/store/favoritesStore';
import {useCursorStore} from '../../../src/store/cursorStore';
import {useEngineVolumeStore} from '../../../src/store/engineVolumeStore';
import {inMemoryStorage, type StateStorage} from '../../../src/store/storage';
import {engineVolumeValueForPosition} from '../../../src/helpers/engineVolume';
import {CURRENT_SCHEMA_VERSION} from '../../../src/types/schemaVersion';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import type {PerformanceSnapshot} from '../../../src/types/performanceSnapshot';
import type {Profile, ProfileExportFile} from '../../../src/types/profile';
import type {FilePickerAdapter} from '../../../src/services/profiles/FilePickerAdapter';
import {
  engineVolumeMessage,
  makeEngineVolumeHarness,
  settle,
} from '../../fixtures/engineVolumeHarness';

const PROFILES_KEY = 'pianel:profiles';
const READ_BACK_OUTPUT_VOLUME = 30;
const NOW = '2026-01-01T00:00:00.000Z';

const snapshotWith = (volume: number): PerformanceSnapshot => ({
  ...DEFAULT_PERFORMANCE_SNAPSHOT,
  metronome: {},
  quickToneSlots: [null, null, null],
  volume,
});

function savedProfile(): Profile {
  return {
    id: '1-abcdef12',
    name: 'Bar Gig',
    schemaVersion: 3,
    theme: 'system',
    accidentals: 'sharps',
    favorites: [],
    presets: [
      {
        id: '1-preset01',
        label: 'Warm',
        tilePosition: 0,
        snapshot: snapshotWith(45),
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    songs: [
      {
        id: '1-song0001',
        name: 'Ballad',
        notes: '',
        scenes: [
          {id: '1-scene001', label: 'Intro', notes: '', snapshot: snapshotWith(80), createdAt: NOW, updatedAt: NOW},
        ],
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    setlists: [
      {
        id: '1-setlist1',
        name: 'Friday',
        entries: [
          {
            songId: '1-song0001',
            override: {
              id: '1-override',
              name: 'Ballad',
              notes: '',
              scenes: [
                {id: '1-scene002', label: 'Intro', notes: '', snapshot: snapshotWith(25), createdAt: NOW, updatedAt: NOW},
              ],
              createdAt: NOW,
              updatedAt: NOW,
            },
          },
        ],
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    defaultState: snapshotWith(60),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function snapshotVolumes(profile: Profile) {
  return {
    defaultState: profile.defaultState.volume,
    presets: profile.presets.map(p => p.snapshot.volume),
    songs: profile.songs.map(s => s.scenes.map(sc => sc.snapshot.volume)),
    overrides: profile.setlists.map(l =>
      l.entries.map(e => e.override?.scenes.map(sc => sc.snapshot.volume) ?? null),
    ),
  };
}

const SAVED_VOLUMES = {
  defaultState: 60,
  presets: [45],
  songs: [[80]],
  overrides: [[[25]]],
};

function makeStorage(seed: Record<string, string> = {}): StateStorage {
  const map: Record<string, string> = {...seed};
  return {
    getItem: k => map[k] ?? null,
    setItem: (k, v) => {
      map[k] = v;
    },
    removeItem: k => {
      delete map[k];
    },
  };
}

function picker(content: string | null = null) {
  const saved: string[] = [];
  const adapter: FilePickerAdapter = {
    async openProfileJson() {
      return content;
    },
    async saveProfileJson(_name, contents) {
      saved.push(contents);
      return true;
    },
  };
  return {adapter, saved};
}

async function connectedRig(filePicker: FilePickerAdapter = picker().adapter) {
  const h = makeEngineVolumeHarness({readBackOutputVolume: READ_BACK_OUTPUT_VOLUME});
  const profiles = new ProfileService(h.piano, filePicker, h.presets);
  const songs = new SongService(h.presets);
  const setlists = new SetlistService(songs);
  const cursor = new SetlistCursorService(songs, setlists, h.presets);
  await settle(h.conn.connect('device-1'));
  h.clearSent();
  return {...h, profiles, songs, setlists, cursor};
}

async function setEngineVolumeSettled(
  rig: Awaited<ReturnType<typeof connectedRig>>,
  position: number,
) {
  rig.piano.setEngineVolume(position);
  await jest.advanceTimersByTimeAsync(100);
  rig.clearSent();
}

beforeAll(() => {
  createConnectionStore({storage: inMemoryStorage});
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
  createFavoritesStore({storage: inMemoryStorage});
});

beforeEach(() => {
  jest.useFakeTimers();
  createProfilesStore({storage: makeStorage()});
  useConnectionStore.getState().reset();
  usePerformanceStore.getState().resetPerformance();
  useEngineVolumeStore.getState().reset();
  useCursorStore.getState().exit();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('every snapshot path records and restores Engine Volume', () => {
  it('a profile default state captures and restores Engine Volume without touching Output Volume', async () => {
    const rig = await connectedRig();
    await setEngineVolumeSettled(rig, 44);
    const profile = await rig.profiles.createProfile('Church');
    expect(profile.defaultState.volume).toBe(44);

    await setEngineVolumeSettled(rig, 90);
    await settle(rig.profiles.applySnapshot(profile.defaultState), 3000);

    expect(useEngineVolumeStore.getState().position).toBe(44);
    expect(rig.engineVolumeSends()).toEqual([
      engineVolumeMessage(engineVolumeValueForPosition(44)),
    ]);
    expect(rig.outputVolumeWrites()).toEqual([]);
    expect(usePerformanceStore.getState().outputVolume).toBe(READ_BACK_OUTPUT_VOLUME);
    await rig.conn.disconnect();
  });

  it('a song scene captures and recalls Engine Volume without touching Output Volume', async () => {
    const rig = await connectedRig();
    await rig.profiles.ensureDefaultProfile();
    const song = rig.songs.createSong('Ballad');
    await setEngineVolumeSettled(rig, 52);
    const scene = rig.songs.captureScene(song.id, 'Verse');
    expect(scene.snapshot.volume).toBe(52);

    await setEngineVolumeSettled(rig, 100);
    await settle(rig.cursor.enterPerform({songId: song.id}), 3000);

    expect(useEngineVolumeStore.getState().position).toBe(52);
    expect(rig.engineVolumeSends()).toEqual([
      engineVolumeMessage(engineVolumeValueForPosition(52)),
    ]);
    expect(rig.outputVolumeWrites()).toEqual([]);
    await rig.conn.disconnect();
  });

  it('a setlist entry override scene applied through the cursor restores its own Engine Volume', async () => {
    const rig = await connectedRig();
    await rig.profiles.ensureDefaultProfile();
    const song = rig.songs.createSong('Ballad');
    await setEngineVolumeSettled(rig, 80);
    rig.songs.captureScene(song.id, 'Intro');
    const list = rig.setlists.createSetlist('Friday');
    rig.setlists.addSong(list.id, song.id);
    rig.setlists.customizeEntry(list.id, 0);
    rig.setlists.editOverride(list.id, 0, s => ({
      ...s,
      scenes: s.scenes.map(sc => ({...sc, snapshot: {...sc.snapshot, volume: 25}})),
    }));

    await setEngineVolumeSettled(rig, 100);
    await settle(rig.cursor.enterPerform({setlistId: list.id}), 3000);

    expect(useEngineVolumeStore.getState().position).toBe(25);
    expect(rig.engineVolumeSends()).toEqual([
      engineVolumeMessage(engineVolumeValueForPosition(25)),
    ]);
    expect(rig.outputVolumeWrites()).toEqual([]);
    expect(usePerformanceStore.getState().outputVolume).toBe(READ_BACK_OUTPUT_VOLUME);
    await rig.conn.disconnect();
  });
});

describe('previously saved profiles stay untouched', () => {
  it('a profile loaded from local storage keeps its schema version and snapshot volumes', async () => {
    const profile = savedProfile();
    const raw = JSON.stringify({
      state: {profiles: [profile], activeProfileId: profile.id},
      version: 0,
    });
    const storage = makeStorage({[PROFILES_KEY]: raw});
    createProfilesStore({storage});
    await useProfilesStore.persist.rehydrate();

    const loaded = useProfilesStore.getState().profiles[0];
    expect(loaded).toEqual(profile);
    expect(loaded.schemaVersion).toBe(3);
    expect(snapshotVolumes(loaded)).toEqual(SAVED_VOLUMES);

    const stored = JSON.parse(storage.getItem(PROFILES_KEY) as string);
    expect(stored.state.profiles[0]).toEqual(profile);
  });

  it('a snapshot from a profile loaded from local storage sends the Engine Volume for its value', async () => {
    const profile = savedProfile();
    createProfilesStore({
      storage: makeStorage({
        [PROFILES_KEY]: JSON.stringify({
          state: {profiles: [profile], activeProfileId: profile.id},
          version: 0,
        }),
      }),
    });
    await useProfilesStore.persist.rehydrate();
    const rig = await connectedRig();

    await settle(rig.profiles.applyPreset('1-preset01'), 3000);

    expect(useEngineVolumeStore.getState().position).toBe(45);
    expect(rig.engineVolumeSends()).toEqual([
      engineVolumeMessage(engineVolumeValueForPosition(45)),
    ]);
    expect(rig.outputVolumeWrites()).toEqual([]);
    expect(useProfilesStore.getState().profiles[0]).toEqual(profile);
    await rig.conn.disconnect();
  });

  it('an imported profile file keeps its schema version and snapshot volumes, and exports them unchanged', async () => {
    const file: ProfileExportFile = {
      schemaVersion: 3 as typeof CURRENT_SCHEMA_VERSION,
      exportedAt: NOW,
      profile: savedProfile(),
    };
    const {adapter, saved} = picker(JSON.stringify(file));
    const rig = await connectedRig(adapter);

    const result = await rig.profiles.importProfile();
    expect(result.kind).toBe('imported');
    const imported = (result as {kind: 'imported'; profile: Profile}).profile;
    expect(imported.schemaVersion).toBe(3);
    expect(snapshotVolumes(imported)).toEqual(SAVED_VOLUMES);

    await rig.profiles.exportProfile(imported.id);
    const exported = JSON.parse(saved[0]) as ProfileExportFile;
    expect(exported.schemaVersion).toBe(3);
    expect(snapshotVolumes(exported.profile)).toEqual(SAVED_VOLUMES);

    await settle(rig.presets.applySnapshot(imported.songs[0].scenes[0].snapshot), 3000);
    expect(useEngineVolumeStore.getState().position).toBe(80);
    expect(rig.engineVolumeSends()).toEqual([
      engineVolumeMessage(engineVolumeValueForPosition(80)),
    ]);
    expect(rig.outputVolumeWrites()).toEqual([]);
    await rig.conn.disconnect();
  });
});
