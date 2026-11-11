import {PianoService} from '../../src/services/PianoService';
import {FP30XEngine} from '../../src/engine/fp30x/FP30XEngine';
import {
  usePerformanceStore,
  createPerformanceStore,
} from '../../src/store/performanceStore';
import {createAppSettingsStore} from '../../src/store/appSettingsStore';
import {inMemoryStorage} from '../../src/store/storage';
import type {Transport} from '../../src/transport/types';

beforeAll(() => {
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
});

function makeTransport() {
  const sent: number[][] = [];
  const transport: Transport = {
    status: 'connected',
    send: jest.fn(async (m: number[]) => {
      sent.push(m);
    }),
    subscribe: jest.fn().mockReturnValue(() => {}),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    scan: jest.fn().mockResolvedValue(undefined),
    stopScan: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
  return {transport, sent};
}

const isOutputVolumeWrite = (m: number[]) =>
  m[7] === 0x12 && m[8] === 0x01 && m[9] === 0x00 && m[10] === 0x02 && m[11] === 0x13;

describe('PianoService Output Volume', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    usePerformanceStore.getState().resetPerformance();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('writes the store optimistically even without an engine', async () => {
    const {transport, sent} = makeTransport();
    const service = new PianoService(transport);
    await service.changeOutputVolume(37);
    expect(usePerformanceStore.getState().outputVolume).toBe(37);
    await jest.advanceTimersByTimeAsync(100);
    expect(sent).toEqual([]);
  });

  it('clamps the stored value to 0-100', async () => {
    const service = new PianoService(makeTransport().transport);
    await service.changeOutputVolume(140);
    expect(usePerformanceStore.getState().outputVolume).toBe(100);
    await service.changeOutputVolume(-3);
    expect(usePerformanceStore.getState().outputVolume).toBe(0);
    await service.changeOutputVolume(12.4);
    expect(usePerformanceStore.getState().outputVolume).toBe(12);
  });

  it('debounces sends by 50 ms and only sends the last value', async () => {
    const {transport, sent} = makeTransport();
    const service = new PianoService(transport);
    service.setEngine(new FP30XEngine());
    await service.changeOutputVolume(10);
    await service.changeOutputVolume(20);
    await service.changeOutputVolume(30);
    await jest.advanceTimersByTimeAsync(49);
    expect(sent.filter(isOutputVolumeWrite)).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(1);
    const writes = sent.filter(isOutputVolumeWrite);
    expect(writes).toEqual([new FP30XEngine().buildOutputVolumeChange(30)]);
  });

  it('maps the outputVolume event onto the store', () => {
    const service = new PianoService(makeTransport().transport);
    service.dispatchEvent({type: 'outputVolume', value: 64});
    expect(usePerformanceStore.getState().outputVolume).toBe(64);
  });
});
