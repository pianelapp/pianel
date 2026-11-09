import {PianoService} from '../../src/services/PianoService';
import {FP30XEngine} from '../../src/engine/fp30x/FP30XEngine';
import {
  createConnectionStore,
  useConnectionStore,
} from '../../src/store/connectionStore';
import {createPerformanceStore} from '../../src/store/performanceStore';
import {createAppSettingsStore} from '../../src/store/appSettingsStore';
import {useEngineVolumeStore} from '../../src/store/engineVolumeStore';
import {inMemoryStorage} from '../../src/store/storage';
import type {Transport} from '../../src/transport/types';

class UnsupportedEngine extends FP30XEngine {
  override readonly supportsEngineVolume: boolean = false;
  override buildEngineVolumeChange(): number[] {
    return [];
  }
}

const isEngineVolume = (m: number[]) =>
  m[0] === 0xf0 && m[1] === 0x7f && m[2] === 0x7f && m[3] === 0x04 && m[4] === 0x01;

const engineVolumeMessage = (vv: number) => [
  0xf0, 0x7f, 0x7f, 0x04, 0x01, 0x00, vv, 0xf7,
];

function makeTransport() {
  const sent: number[][] = [];
  let failing = false;
  const transport: Transport = {
    status: 'connected',
    send: jest.fn(async (m: number[]) => {
      if (failing) throw new Error('link down');
      sent.push(m);
    }),
    subscribe: jest.fn().mockReturnValue(() => {}),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    scan: jest.fn().mockResolvedValue(undefined),
    stopScan: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
  return {
    transport,
    sent,
    engineVolumeSends: () => sent.filter(isEngineVolume),
    setFailing(value: boolean) {
      failing = value;
    },
  };
}

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
  jest.useRealTimers();
});

describe('PianoService.setEngineVolume', () => {
  it('updates the store immediately with no piano connected and sends nothing', async () => {
    const h = makeTransport();
    const service = new PianoService(h.transport);
    service.setEngineVolume(42);
    expect(useEngineVolumeStore.getState().position).toBe(42);
    await jest.advanceTimersByTimeAsync(100);
    expect(h.sent).toEqual([]);
  });

  it('clamps the position before storing it', () => {
    const service = new PianoService(makeTransport().transport);
    service.setEngineVolume(140);
    expect(useEngineVolumeStore.getState().position).toBe(100);
    service.setEngineVolume(-2);
    expect(useEngineVolumeStore.getState().position).toBe(0);
  });

  it('does not send while an engine is present but the link is not connected', async () => {
    const h = makeTransport();
    const service = new PianoService(h.transport);
    service.setEngine(new FP30XEngine());
    useConnectionStore.getState().setDisconnected();
    service.setEngineVolume(70);
    await jest.advanceTimersByTimeAsync(100);
    expect(h.engineVolumeSends()).toEqual([]);
    expect(useEngineVolumeStore.getState().position).toBe(70);
  });

  it.each(['connected', 'stale'] as const)(
    'sends the curve value while %s',
    async status => {
      const h = makeTransport();
      const service = new PianoService(h.transport);
      service.setEngine(new FP30XEngine());
      useConnectionStore.getState().setConnected();
      if (status === 'stale') useConnectionStore.getState().setStale();
      service.setEngineVolume(70);
      await jest.advanceTimersByTimeAsync(100);
      expect(h.engineVolumeSends()).toEqual([engineVolumeMessage(94)]);
    },
  );

  it('sends only when the piano value changes', async () => {
    const h = makeTransport();
    const service = new PianoService(h.transport);
    service.setEngine(new FP30XEngine());
    useConnectionStore.getState().setConnected();
    service.setEngineVolume(60);
    await jest.advanceTimersByTimeAsync(100);
    service.setEngineVolume(60);
    await jest.advanceTimersByTimeAsync(100);
    expect(h.engineVolumeSends()).toEqual([engineVolumeMessage(82)]);
  });

  it('rate-limits a drag and delivers the last value', async () => {
    const h = makeTransport();
    const service = new PianoService(h.transport);
    service.setEngine(new FP30XEngine());
    useConnectionStore.getState().setConnected();
    for (let p = 100; p >= 0; p--) {
      service.setEngineVolume(p);
      await jest.advanceTimersByTimeAsync(2);
    }
    await jest.advanceTimersByTimeAsync(200);
    const sends = h.engineVolumeSends();
    expect(sends.length).toBeLessThanOrEqual(10);
    expect(sends[sends.length - 1]).toEqual(engineVolumeMessage(0));
    expect(useEngineVolumeStore.getState().position).toBe(0);
  });

  it('never produces Engine Volume bytes for an unsupported engine', async () => {
    const h = makeTransport();
    const service = new PianoService(h.transport);
    service.setEngine(new UnsupportedEngine());
    useConnectionStore.getState().setConnected();
    service.setEngineVolume(30);
    await jest.advanceTimersByTimeAsync(100);
    expect(h.engineVolumeSends()).toEqual([]);
    expect(h.sent).toEqual([]);
    expect(useEngineVolumeStore.getState().position).toBe(30);
  });

  it('keeps the chosen position when the send fails, without throwing', async () => {
    const h = makeTransport();
    const service = new PianoService(h.transport);
    service.setEngine(new FP30XEngine());
    useConnectionStore.getState().setConnected();
    h.setFailing(true);
    expect(() => service.setEngineVolume(25)).not.toThrow();
    await jest.advanceTimersByTimeAsync(100);
    expect(useEngineVolumeStore.getState().position).toBe(25);
  });
});

describe('PianoService.setEngine', () => {
  it('mirrors the engine support flag into the store', () => {
    const service = new PianoService(makeTransport().transport);
    service.setEngine(new UnsupportedEngine());
    expect(useEngineVolumeStore.getState().supported).toBe(false);
    service.setEngine(new FP30XEngine());
    expect(useEngineVolumeStore.getState().supported).toBe(true);
  });
});

describe('PianoService.resyncEngineVolume', () => {
  it('skips with not-connected when there is no engine', async () => {
    const service = new PianoService(makeTransport().transport);
    await expect(service.resyncEngineVolume()).resolves.toEqual({
      status: 'skipped',
      reason: 'not-connected',
    });
  });

  it('skips with not-connected when the link is down', async () => {
    const h = makeTransport();
    const service = new PianoService(h.transport);
    service.setEngine(new FP30XEngine());
    await expect(service.resyncEngineVolume()).resolves.toEqual({
      status: 'skipped',
      reason: 'not-connected',
    });
    expect(h.sent).toEqual([]);
  });

  it('skips with unsupported for an engine without Engine Volume', async () => {
    const h = makeTransport();
    const service = new PianoService(h.transport);
    service.setEngine(new UnsupportedEngine());
    useConnectionStore.getState().setConnected();
    await expect(service.resyncEngineVolume()).resolves.toEqual({
      status: 'skipped',
      reason: 'unsupported',
    });
    expect(h.sent).toEqual([]);
  });

  it('force-sends the current value, including the full level', async () => {
    const h = makeTransport();
    const service = new PianoService(h.transport);
    service.setEngine(new FP30XEngine());
    useConnectionStore.getState().setConnected();
    await expect(service.resyncEngineVolume()).resolves.toEqual({
      status: 'delivered',
      value: 127,
    });
    const second = service.resyncEngineVolume();
    await jest.advanceTimersByTimeAsync(100);
    await expect(second).resolves.toEqual({status: 'delivered', value: 127});
    expect(h.engineVolumeSends()).toEqual([
      engineVolumeMessage(127),
      engineVolumeMessage(127),
    ]);
  });

  it('reports a failed delivery without rejecting', async () => {
    const h = makeTransport();
    const service = new PianoService(h.transport);
    service.setEngine(new FP30XEngine());
    useConnectionStore.getState().setConnected();
    service.setEngineVolume(50);
    await jest.advanceTimersByTimeAsync(100);
    h.setFailing(true);
    const result = service.resyncEngineVolume();
    await jest.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toEqual({status: 'failed', value: 70});
    expect(useEngineVolumeStore.getState().position).toBe(50);
  });
});

describe('PianoService.handleLinkClosed', () => {
  it('cancels a pending trailing send', async () => {
    const h = makeTransport();
    const service = new PianoService(h.transport);
    service.setEngine(new FP30XEngine());
    useConnectionStore.getState().setConnected();
    service.setEngineVolume(80);
    await jest.advanceTimersByTimeAsync(1);
    service.setEngineVolume(40);
    service.handleLinkClosed();
    await jest.advanceTimersByTimeAsync(200);
    expect(h.engineVolumeSends()).toEqual([engineVolumeMessage(105)]);
    expect(useEngineVolumeStore.getState().position).toBe(40);
  });

  it('forgets the delivered value so the next send is not skipped', async () => {
    const h = makeTransport();
    const service = new PianoService(h.transport);
    service.setEngine(new FP30XEngine());
    useConnectionStore.getState().setConnected();
    service.setEngineVolume(80);
    await jest.advanceTimersByTimeAsync(100);
    service.handleLinkClosed();
    service.setEngineVolume(80);
    await jest.advanceTimersByTimeAsync(100);
    expect(h.engineVolumeSends()).toEqual([
      engineVolumeMessage(105),
      engineVolumeMessage(105),
    ]);
  });
});
