import {PianoService} from '../../src/services/PianoService';
import {FP30XEngine} from '../../src/engine/fp30x/FP30XEngine';
import {fp30xToneCatalog} from '../../src/engine/fp30x/tones';
import {
  useConnectionStore,
  createConnectionStore,
} from '../../src/store/connectionStore';
import {useMidiChannelStore} from '../../src/store/midiChannelStore';
import {inMemoryStorage} from '../../src/store/storage';
import type {Transport} from '../../src/transport/types';

beforeAll(() => {
  createConnectionStore({storage: inMemoryStorage});
});

const DEVICE = 'piano-a';
const MARK = '2026-09-04T00:00:00.000Z';

const concertPiano = fp30xToneCatalog.findById('0-0-0')!;
const ragtimePiano = fp30xToneCatalog.findById('0-0-8')!;

function triples(messages: number[][]): number[][][] {
  const out: number[][][] = [];
  for (let i = 0; i < messages.length; i += 3) {
    out.push(messages.slice(i, i + 3));
  }
  return out;
}

function isTriple(triple: number[][]): boolean {
  return (
    triple.length === 3 &&
    triple[0][1] === 0x00 &&
    triple[1][1] === 0x20 &&
    (triple[2][0] & 0xf0) === 0xc0 &&
    (triple[0][0] & 0x0f) === (triple[1][0] & 0x0f) &&
    (triple[1][0] & 0x0f) === (triple[2][0] & 0x0f)
  );
}

function makeService(): {service: PianoService; sent: number[][]} {
  const sent: number[][] = [];
  const transport: Transport = {
    status: 'connected',
    // Resolving on a later macrotask gives a concurrent commit every chance to
    // interleave; only the FIFO chain stops it.
    send: jest.fn((msg: number[]) => {
      sent.push(msg);
      return new Promise<void>(resolve => setTimeout(resolve, 0));
    }),
    subscribe: jest.fn().mockReturnValue(() => {}),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    scan: jest.fn().mockResolvedValue(undefined),
    stopScan: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PianoService(transport);
  service.setEngine(new FP30XEngine());
  return {service, sent};
}

beforeEach(() => {
  useMidiChannelStore.getState().reset();
  useConnectionStore.setState({
    status: 'connected',
    deviceId: DEVICE,
    lastConnectedAt: MARK,
  });
});

describe('PianoService.assignChannelTone — ordering', () => {
  it('never interleaves two commits at the same channel', async () => {
    const {service, sent} = makeService();

    const first = service.assignChannelTone(5, concertPiano);
    const second = service.assignChannelTone(5, ragtimePiano);
    const results = await Promise.all([first, second]);

    expect(results.map(r => r.status)).toEqual(['applied', 'applied']);
    expect(sent).toHaveLength(6);

    const [a, b] = triples(sent);
    expect(isTriple(a)).toBe(true);
    expect(isTriple(b)).toBe(true);
    expect(a).toEqual([
      [0xb4, 0x00, 0],
      [0xb4, 0x20, 68],
      [0xc4, 0],
    ]);
    expect(b).toEqual([
      [0xb4, 0x00, 0],
      [0xb4, 0x20, 64],
      [0xc4, 3],
    ]);

    expect(useMidiChannelStore.getState().assignments[5]?.toneId).toBe(
      ragtimePiano.id,
    );
  });

  it('lands both commits when they target different channels', async () => {
    const {service, sent} = makeService();

    const results = await Promise.all([
      service.assignChannelTone(5, concertPiano),
      service.assignChannelTone(6, ragtimePiano),
    ]);

    expect(results.map(r => r.status)).toEqual(['applied', 'applied']);
    expect(sent).toHaveLength(6);
    for (const t of triples(sent)) expect(isTriple(t)).toBe(true);

    const {assignments} = useMidiChannelStore.getState();
    expect(assignments[5]?.toneId).toBe(concertPiano.id);
    expect(assignments[6]?.toneId).toBe(ragtimePiano.id);
  });

  it('turns an engine fault into a refusal and keeps the queue usable', async () => {
    const {service} = makeService();
    const engine = new FP30XEngine();
    let boom = true;
    const real = engine.planChannelToneChange.bind(engine);
    jest.spyOn(engine, 'planChannelToneChange').mockImplementation((c, t) => {
      if (boom) throw new Error('engine exploded');
      return real(c, t);
    });
    service.setEngine(engine);

    await expect(
      service.assignChannelTone(5, concertPiano),
    ).resolves.toEqual({
      status: 'refused',
      channel: 5,
      reason: 'send-failed',
    });

    boom = false;
    await expect(
      service.assignChannelTone(6, ragtimePiano),
    ).resolves.toMatchObject({status: 'applied'});
  });

  it('keeps the same instance queue usable after a failed commit', async () => {
    const sent: number[][] = [];
    let failNext = true;
    const send = jest.fn((msg: number[]) => {
      if (failNext) return Promise.reject(new Error('BLE gone'));
      sent.push(msg);
      return new Promise<void>(resolve => setTimeout(resolve, 0));
    });
    const transport = {
      status: 'connected',
      send,
      subscribe: jest.fn().mockReturnValue(() => {}),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      scan: jest.fn().mockResolvedValue(undefined),
      stopScan: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transport;
    const service = new PianoService(transport);
    service.setEngine(new FP30XEngine());

    const bad = await service.assignChannelTone(5, concertPiano);
    expect(bad).toEqual({
      status: 'refused',
      channel: 5,
      reason: 'send-failed',
    });

    failNext = false;
    const later = await service.assignChannelTone(6, ragtimePiano);

    expect(later.status).toBe('applied');
    expect(sent).toHaveLength(3);
    expect(isTriple(sent)).toBe(true);
    expect(useMidiChannelStore.getState().assignments).toEqual({
      6: {toneId: ragtimePiano.id, connectionMark: MARK},
    });
  });
});
