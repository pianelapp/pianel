import {ConnectionService} from '../../src/services/ConnectionService';
import {PianoService} from '../../src/services/PianoService';
import {
  createConnectionStore,
  useConnectionStore,
} from '../../src/store/connectionStore';
import {
  createPerformanceStore,
  usePerformanceStore,
} from '../../src/store/performanceStore';
import {createAppSettingsStore} from '../../src/store/appSettingsStore';
import {createProfilesStore} from '../../src/store/profilesStore';
import {createFavoritesStore} from '../../src/store/favoritesStore';
import {useEngineVolumeStore} from '../../src/store/engineVolumeStore';
import {inMemoryStorage} from '../../src/store/storage';
import type {Transport, NotificationListener} from '../../src/transport/types';

const IDENTITY_REPLY = [
  0xf0, 0x7e, 0x10, 0x06, 0x02, 0x41, 0x19, 0x03, 0x00, 0x00, 0x1c, 0x01, 0x00,
  0x00, 0xf7,
];

const engineVolumeMessage = (vv: number) => [
  0xf0, 0x7f, 0x7f, 0x04, 0x01, 0x00, vv, 0xf7,
];

const isEngineVolume = (m: number[]) =>
  m[0] === 0xf0 && m[1] === 0x7f && m[2] === 0x7f && m[3] === 0x04 && m[4] === 0x01;

const isIdentityRequest = (m: number[]) =>
  m[0] === 0xf0 && m[1] === 0x7e && m[4] === 0x01;

const isRq1 = (m: number[]) => m[0] === 0xf0 && m[1] === 0x41 && m[7] === 0x11;

const isPerformanceBlockRequest = (m: number[]) =>
  isRq1(m) && m[8] === 0x01 && m[9] === 0x00 && m[10] === 0x02 && m[11] === 0x00;

function performanceBlockResponse(outputVolume: number): number[] {
  const address = [0x01, 0x00, 0x02, 0x00];
  const data = new Array(0x24).fill(0);
  data[0x13] = outputVolume;
  data[0x1d] = 0x03;
  let sum = 0;
  for (const b of [...address, ...data]) sum += b;
  const checksum = (128 - (sum % 128)) % 128;
  return [
    0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
    ...address, ...data, checksum, 0xf7,
  ];
}

interface HarnessOptions {
  replyIdentity?: boolean;
  readBackOutputVolume?: number;
}

function makeHarness(options: HarnessOptions = {}) {
  const {replyIdentity = true, readBackOutputVolume} = options;
  const sent: number[][] = [];
  const listeners: NotificationListener[] = [];
  let status: 'idle' | 'connected' | 'disconnected' = 'idle';
  let rejectEngineVolume = false;

  const emit = (bytes: number[]) => {
    for (const l of [...listeners]) l(bytes);
  };

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
      if (isEngineVolume(m) && rejectEngineVolume) {
        throw new Error('send rejected');
      }
      sent.push(m);
      if (replyIdentity && isIdentityRequest(m)) {
        queueMicrotask(() => emit(IDENTITY_REPLY));
      }
      if (readBackOutputVolume !== undefined && isPerformanceBlockRequest(m)) {
        queueMicrotask(() => emit(performanceBlockResponse(readBackOutputVolume)));
      }
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
  conn.setNotificationHandler(event => piano.dispatchEvent(event));

  return {
    conn,
    piano,
    transport,
    sent,
    engineVolumeSends: () => sent.filter(isEngineVolume),
    dropLink() {
      status = 'disconnected';
    },
    setRejectEngineVolume(value: boolean) {
      rejectEngineVolume = value;
    },
  };
}

async function settle(promise: Promise<unknown>, ms = 600) {
  for (let elapsed = 0; elapsed < ms; elapsed += 50) {
    await jest.advanceTimersByTimeAsync(50);
  }
  await promise;
}

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

afterEach(async () => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('ConnectionService Engine Volume resync', () => {
  it('sends the full-level message exactly once on a fresh connect, before the first read-back request', async () => {
    const h = makeHarness();
    await settle(h.conn.connect('device-1'));

    expect(h.engineVolumeSends()).toEqual([engineVolumeMessage(127)]);
    const evIndex = h.sent.findIndex(isEngineVolume);
    const firstRq1 = h.sent.findIndex(isRq1);
    expect(evIndex).toBeGreaterThanOrEqual(0);
    expect(firstRq1).toBeGreaterThan(evIndex);
    await h.conn.disconnect();
  });

  it('delivers a value set while disconnected as its curve value on connect', async () => {
    const h = makeHarness();
    h.piano.setEngineVolume(50);
    expect(h.sent).toEqual([]);
    await settle(h.conn.connect('device-1'));
    expect(h.engineVolumeSends()).toEqual([engineVolumeMessage(70)]);
    await h.conn.disconnect();
  });

  it('resends the current value on a user-initiated reconnect', async () => {
    const h = makeHarness();
    await settle(h.conn.connect('device-1'));
    h.piano.setEngineVolume(70);
    await jest.advanceTimersByTimeAsync(100);
    await h.conn.disconnect();
    await settle(h.conn.connect('device-1'));

    expect(h.engineVolumeSends()).toEqual([
      engineVolumeMessage(127),
      engineVolumeMessage(94),
      engineVolumeMessage(94),
    ]);
    await h.conn.disconnect();
  });

  it('resends the current value on an automatic reconnect', async () => {
    const h = makeHarness();
    await settle(h.conn.connect('device-1'));
    h.piano.setEngineVolume(60);
    await jest.advanceTimersByTimeAsync(100);
    const handleLinkClosed = jest.spyOn(h.piano, 'handleLinkClosed');

    h.dropLink();
    await jest.advanceTimersByTimeAsync(1000);
    expect(handleLinkClosed).toHaveBeenCalled();
    expect(useConnectionStore.getState().status).toBe('disconnected');

    await settle(Promise.resolve(), 2600);
    expect(useConnectionStore.getState().status).toBe('connected');
    expect(h.engineVolumeSends()).toEqual([
      engineVolumeMessage(127),
      engineVolumeMessage(82),
      engineVolumeMessage(82),
    ]);
    await h.conn.disconnect();
  });

  it('notifies the piano service of link closure on user disconnect', async () => {
    const h = makeHarness();
    await settle(h.conn.connect('device-1'));
    const handleLinkClosed = jest.spyOn(h.piano, 'handleLinkClosed');
    await h.conn.disconnect();
    expect(handleLinkClosed).toHaveBeenCalledTimes(1);
  });

  it('does not fail the connect when the Engine Volume send rejects', async () => {
    const h = makeHarness();
    h.setRejectEngineVolume(true);
    const resync = jest.spyOn(h.piano, 'resyncEngineVolume');
    await expect(settle(h.conn.connect('device-1'))).resolves.toBeUndefined();
    expect(useConnectionStore.getState().status).toBe('connected');
    await expect(resync.mock.results[0].value).resolves.toEqual({
      status: 'failed',
      value: 127,
    });
    expect(h.sent.some(isRq1)).toBe(true);
    expect(useEngineVolumeStore.getState().position).toBe(100);
    await h.conn.disconnect();
  });

  it('leaves the Engine Volume record unchanged through the read-back sweep', async () => {
    const h = makeHarness({readBackOutputVolume: 30});
    h.piano.setEngineVolume(37);
    await settle(h.conn.connect('device-1'));
    expect(usePerformanceStore.getState().outputVolume).toBe(30);
    expect(useEngineVolumeStore.getState().position).toBe(37);
    await h.conn.disconnect();
  });
});
