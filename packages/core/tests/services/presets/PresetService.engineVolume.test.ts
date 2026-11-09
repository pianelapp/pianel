import {
  createConnectionStore,
  useConnectionStore,
} from '../../../src/store/connectionStore';
import {
  createPerformanceStore,
  usePerformanceStore,
} from '../../../src/store/performanceStore';
import {createAppSettingsStore} from '../../../src/store/appSettingsStore';
import {createProfilesStore} from '../../../src/store/profilesStore';
import {createFavoritesStore} from '../../../src/store/favoritesStore';
import {useEngineVolumeStore} from '../../../src/store/engineVolumeStore';
import {inMemoryStorage} from '../../../src/store/storage';
import {engineVolumeValueForPosition} from '../../../src/helpers/engineVolume';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../../src/types/performanceSnapshot';
import type {PerformanceSnapshot} from '../../../src/types/performanceSnapshot';
import {
  engineVolumeMessage,
  isDt1,
  isEngineVolume,
  isRq1,
  makeEngineVolumeHarness,
  settle,
} from '../../fixtures/engineVolumeHarness';

const snapshotWith = (volume: number): PerformanceSnapshot => ({
  ...DEFAULT_PERFORMANCE_SNAPSHOT,
  volume,
  tempo: 100,
});

beforeAll(() => {
  createConnectionStore({storage: inMemoryStorage});
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
  createProfilesStore({storage: inMemoryStorage});
  createFavoritesStore({storage: inMemoryStorage});
});

beforeEach(() => {
  jest.useFakeTimers();
  useConnectionStore.getState().reset();
  usePerformanceStore.getState().resetPerformance();
  useEngineVolumeStore.getState().reset();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('PresetService Engine Volume on a connected piano', () => {
  it('captures the Engine Volume position and not the Output Volume read back from the piano', async () => {
    const h = makeEngineVolumeHarness({readBackOutputVolume: 30});
    await settle(h.conn.connect('device-1'));
    h.piano.setEngineVolume(55);
    expect(usePerformanceStore.getState().outputVolume).toBe(30);
    expect(h.presets.captureSnapshot().volume).toBe(55);
    await h.conn.disconnect();
  });

  it('applies a saved volume of 60 as the Master Volume message with piano value 82 and no Output Volume write', async () => {
    const h = makeEngineVolumeHarness();
    await settle(h.conn.connect('device-1'));
    h.clearSent();

    await settle(h.presets.applySnapshot(snapshotWith(60)), 3000);

    expect(h.engineVolumeSends()).toEqual([engineVolumeMessage(82)]);
    expect(h.outputVolumeWrites()).toEqual([]);
    expect(useEngineVolumeStore.getState().position).toBe(60);
    await h.conn.disconnect();
  });

  it('sends the Engine Volume message after the DT1 parameter batch', async () => {
    const h = makeEngineVolumeHarness();
    await settle(h.conn.connect('device-1'));
    h.clearSent();

    await settle(h.presets.applySnapshot(snapshotWith(60)), 3000);

    const evIndex = h.sent.findIndex(isEngineVolume);
    const lastDt1 = h.sent.map(isDt1).lastIndexOf(true);
    expect(lastDt1).toBeGreaterThanOrEqual(0);
    expect(evIndex).toBeGreaterThan(lastDt1);
    await h.conn.disconnect();
  });

  it('keeps the applied position and leaves Output Volume to the piano through the read-back', async () => {
    const h = makeEngineVolumeHarness({readBackOutputVolume: 30});
    await settle(h.conn.connect('device-1'));
    h.clearSent();

    await settle(h.presets.applySnapshot(snapshotWith(60)), 3000);

    expect(h.sent.some(isRq1)).toBe(true);
    expect(useEngineVolumeStore.getState().position).toBe(60);
    expect(usePerformanceStore.getState().outputVolume).toBe(30);
    await h.conn.disconnect();
  });

  it('restores a position captured at 37 and its piano value', async () => {
    const h = makeEngineVolumeHarness();
    await settle(h.conn.connect('device-1'));
    h.piano.setEngineVolume(37);
    await jest.advanceTimersByTimeAsync(100);
    const captured = h.presets.captureSnapshot();
    expect(captured.volume).toBe(37);

    h.piano.setEngineVolume(90);
    await jest.advanceTimersByTimeAsync(100);
    h.clearSent();

    await settle(h.presets.applySnapshot(captured), 3000);

    expect(useEngineVolumeStore.getState().position).toBe(37);
    expect(h.engineVolumeSends()).toEqual([
      engineVolumeMessage(engineVolumeValueForPosition(37)),
    ]);
    await h.conn.disconnect();
  });

  it('delivers a snapshot applied while disconnected on the next connect', async () => {
    const h = makeEngineVolumeHarness();
    await h.presets.applySnapshot(snapshotWith(60));
    expect(h.sent).toEqual([]);
    expect(useEngineVolumeStore.getState().position).toBe(60);

    await settle(h.conn.connect('device-1'));

    expect(h.engineVolumeSends()).toEqual([engineVolumeMessage(82)]);
    await h.conn.disconnect();
  });
});
