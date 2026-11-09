import {FP30XEngine} from '../../src/engine/fp30x/FP30XEngine';

class UnsupportedEngine extends FP30XEngine {
  override readonly supportsEngineVolume: boolean = false;
  override buildEngineVolumeChange(): number[] {
    return [];
  }
}

jest.mock('../../src/engine/registry', () => {
  const engine = new UnsupportedEngine();
  return {
    resolveEngine: () => engine,
    getDefaultEngine: () => engine,
  };
});

import {ConnectionService} from '../../src/services/ConnectionService';
import {PianoService} from '../../src/services/PianoService';
import {
  createConnectionStore,
  useConnectionStore,
} from '../../src/store/connectionStore';
import {createPerformanceStore} from '../../src/store/performanceStore';
import {createAppSettingsStore} from '../../src/store/appSettingsStore';
import {useEngineVolumeStore} from '../../src/store/engineVolumeStore';
import {inMemoryStorage} from '../../src/store/storage';
import type {Transport, NotificationListener} from '../../src/transport/types';

const isEngineVolume = (m: number[]) =>
  m[0] === 0xf0 && m[1] === 0x7f && m[2] === 0x7f && m[3] === 0x04 && m[4] === 0x01;

beforeAll(() => {
  createConnectionStore({storage: inMemoryStorage});
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
});

beforeEach(() => {
  jest.useFakeTimers();
  useConnectionStore.getState().reset();
  useEngineVolumeStore.getState().reset();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('ConnectionService with an engine without Engine Volume', () => {
  it('never sends Engine Volume bytes and reports unsupported', async () => {
    const sent: number[][] = [];
    const listeners: NotificationListener[] = [];
    let status: 'idle' | 'connected' | 'disconnected' = 'idle';
    const transport: Transport = {
      get status() {
        return status;
      },
      scan: jest.fn(async () => {}),
      stopScan: jest.fn(async () => {}),
      connect: jest.fn(async () => {
        status = 'connected';
      }),
      disconnect: jest.fn(async () => {
        status = 'disconnected';
      }),
      send: jest.fn(async (m: number[]) => {
        sent.push(m);
      }),
      subscribe: (listener: NotificationListener) => {
        listeners.push(listener);
        return () => {
          const i = listeners.indexOf(listener);
          if (i >= 0) listeners.splice(i, 1);
        };
      },
      destroy: jest.fn(async () => {}),
    };

    const conn = new ConnectionService(transport);
    const piano = new PianoService(transport);
    conn.setPianoService(piano);
    const resync = jest.spyOn(piano, 'resyncEngineVolume');

    piano.setEngineVolume(40);
    const connecting = conn.connect('device-1');
    for (let i = 0; i < 40; i++) await jest.advanceTimersByTimeAsync(50);
    await connecting;

    piano.setEngineVolume(20);
    await jest.advanceTimersByTimeAsync(200);

    expect(sent.filter(isEngineVolume)).toEqual([]);
    expect(useEngineVolumeStore.getState().supported).toBe(false);
    expect(resync).toHaveBeenCalledTimes(1);
    await expect(resync.mock.results[0].value).resolves.toEqual({
      status: 'skipped',
      reason: 'unsupported',
    });
    await conn.disconnect();
  });
});
