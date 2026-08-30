import {PianoService} from '../../src/services/PianoService';
import {FP30XEngine} from '../../src/engine/fp30x/FP30XEngine';
import {
  usePerformanceStore,
  createPerformanceStore,
} from '../../src/store/performanceStore';
import {
  useAppSettingsStore,
  createAppSettingsStore,
} from '../../src/store/appSettingsStore';
import {inMemoryStorage} from '../../src/store/storage';
import type {Transport} from '../../src/transport/types';

class FakeTransport implements Transport {
  status: 'idle' | 'connected' | 'disconnected' = 'idle';
  sent: number[][] = [];
  async scan(): Promise<void> {}
  async stopScan(): Promise<void> {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async destroy(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
  async send(bytes: number[]): Promise<void> {
    this.sent.push([...bytes]);
  }
}

beforeAll(() => {
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
});

function makeService(): {service: PianoService; transport: FakeTransport} {
  const transport = new FakeTransport();
  const service = new PianoService(transport);
  service.setEngine(new FP30XEngine());
  return {service, transport};
}

describe('PianoService.changeKeyTouch', () => {
  beforeEach(() => {
    usePerformanceStore.getState().resetPerformance();
  });

  it('sends the DT1 write for the requested curve', async () => {
    const {service, transport} = makeService();
    await service.changeKeyTouch(2);
    expect(transport.sent).toEqual([
      [0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
       0x01, 0x00, 0x02, 0x1d, 0x02, 0x5e, 0xf7],
    ]);
  });

  it('clamps an out-of-range curve instead of writing it', async () => {
    const {service, transport} = makeService();
    await service.changeKeyTouch(-1);
    expect(transport.sent[0]).toEqual(
      [0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
       0x01, 0x00, 0x02, 0x1d, 0x00, 0x60, 0xf7],
    );
  });

  it('writes immediately rather than debouncing', async () => {
    const {service, transport} = makeService();
    await service.changeKeyTouch(1);
    await service.changeKeyTouch(4);
    expect(transport.sent).toHaveLength(2);
  });

  it('no-ops with no engine set', async () => {
    const transport = new FakeTransport();
    await new PianoService(transport).changeKeyTouch(3);
    expect(transport.sent).toEqual([]);
  });

  it('lands an incoming panel echo on performanceStore', () => {
    const {service} = makeService();
    service.dispatchEvent({type: 'keyTouch', value: 5});
    expect(usePerformanceStore.getState().keyTouch).toBe(5);
  });
});
