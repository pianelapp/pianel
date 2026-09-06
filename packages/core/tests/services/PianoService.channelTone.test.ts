import {PianoService} from '../../src/services/PianoService';
import {FP30XEngine} from '../../src/engine/fp30x/FP30XEngine';
import {fp30xToneCatalog} from '../../src/engine/fp30x/tones';
import {
  useConnectionStore,
  createConnectionStore,
} from '../../src/store/connectionStore';
import {
  usePerformanceStore,
  createPerformanceStore,
} from '../../src/store/performanceStore';
import {
  useAppSettingsStore,
  createAppSettingsStore,
} from '../../src/store/appSettingsStore';
import {useMidiChannelStore} from '../../src/store/midiChannelStore';
import {inMemoryStorage} from '../../src/store/storage';
import type {Transport} from '../../src/transport/types';
import type {Tone} from '../../src/types/types';
import type {MidiChannel} from '../../src/types/midiChannelStrip';

beforeAll(() => {
  createConnectionStore({storage: inMemoryStorage});
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
});

const DEVICE = 'piano-a';
const MARK = '2026-09-04T00:00:00.000Z';

const concertPiano = fp30xToneCatalog.findById('0-0-0')!;
const standardSet = fp30xToneCatalog.categories.find(c => c.id === 0x07)!
  .tones[0];

const unmappedTone: Tone = {
  id: 'synthetic-unmapped',
  name: 'Synthetic Unmapped',
  category: 0x00,
  categoryName: 'Piano',
  indexHigh: 0,
  indexLow: 0,
  position: 999,
  isGM2: false,
};

function makeTransport(
  send: jest.Mock = jest.fn().mockResolvedValue(undefined),
): {transport: Transport; send: jest.Mock} {
  const transport: Transport = {
    status: 'connected',
    send,
    subscribe: jest.fn().mockReturnValue(() => {}),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    scan: jest.fn().mockResolvedValue(undefined),
    stopScan: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
  return {transport, send};
}

function connected(): void {
  useConnectionStore.setState({
    status: 'connected',
    deviceId: DEVICE,
    lastConnectedAt: MARK,
  });
}

beforeEach(() => {
  useMidiChannelStore.getState().reset();
  usePerformanceStore.getState().resetPerformance();
  connected();
});

describe('PianoService.assignChannelTone — applied', () => {
  it('sends exactly three messages in order and records once', async () => {
    const {transport, send} = makeTransport();
    const service = new PianoService(transport);
    service.setEngine(new FP30XEngine());

    const result = await service.assignChannelTone(5, concertPiano);

    expect(result).toEqual({
      status: 'applied',
      channel: 5,
      toneId: concertPiano.id,
    });
    expect(send.mock.calls.map(c => c[0])).toEqual([
      [0xb4, 0x00, 0],
      [0xb4, 0x20, 68],
      [0xc4, 0],
    ]);

    const state = useMidiChannelStore.getState();
    expect(state.deviceId).toBe(DEVICE);
    expect(state.assignments).toEqual({
      5: {toneId: concertPiano.id, connectionMark: MARK},
    });
  });

  it('accepts a rhythm set on the drum channel', async () => {
    const {transport, send} = makeTransport();
    const service = new PianoService(transport);
    service.setEngine(new FP30XEngine());

    const result = await service.assignChannelTone(10, standardSet);

    expect(result.status).toBe('applied');
    expect(send).toHaveBeenCalledTimes(3);
    expect(useMidiChannelStore.getState().assignments[10]?.toneId).toBe(
      standardSet.id,
    );
  });

  it('leaves the performance and app-settings state untouched', async () => {
    const {transport, send} = makeTransport();
    const service = new PianoService(transport);
    service.setEngine(new FP30XEngine());

    const perfBefore = {...usePerformanceStore.getState()};
    const settingsBefore = {...useAppSettingsStore.getState()};

    await service.assignChannelTone(5, concertPiano);

    expect({...usePerformanceStore.getState()}).toEqual(perfBefore);
    expect({...useAppSettingsStore.getState()}).toEqual(settingsBefore);
    const sysex = send.mock.calls.filter(c => c[0][0] === 0xf0);
    expect(sysex).toEqual([]);
  });
});

describe('PianoService.assignChannelTone — refusals send nothing', () => {
  const cases: Array<[string, MidiChannel, Tone, string, () => void]> = [
    ['channel 4', 4, concertPiano, 'keyboard-channel', () => {}],
    ['a melodic tone on channel 10', 10, concertPiano, 'requires-drum-kit', () => {}],
    ['an unmapped tone', 5, unmappedTone, 'tone-not-assignable', () => {}],
    ['no piano connected', 5, concertPiano, 'not-connected', () =>
      useConnectionStore.setState({status: 'disconnected'})],
    ['a stale heartbeat', 5, concertPiano, 'not-connected', () =>
      useConnectionStore.setState({status: 'stale'})],
  ];

  it.each(cases)('refuses %s', async (_label, channel, tone, reason, arrange) => {
    const {transport, send} = makeTransport();
    const service = new PianoService(transport);
    service.setEngine(new FP30XEngine());
    useMidiChannelStore
      .getState()
      .record({channel: 2, toneId: 'pre-existing', deviceId: DEVICE, connectionMark: MARK});
    arrange();

    const result = await service.assignChannelTone(channel, tone);

    expect(result).toEqual({status: 'refused', channel, reason});
    expect(send).not.toHaveBeenCalled();
    expect(useMidiChannelStore.getState().assignments).toEqual({
      2: {toneId: 'pre-existing', connectionMark: MARK},
    });
  });

  it('refuses when no engine is resolved', async () => {
    const {transport, send} = makeTransport();
    const service = new PianoService(transport);

    const result = await service.assignChannelTone(5, concertPiano);

    expect(result).toEqual({
      status: 'refused',
      channel: 5,
      reason: 'not-connected',
    });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('PianoService.assignChannelTone — send failure', () => {
  it('reports send-failed and writes no record when the transport rejects', async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('BLE gone'));
    const {transport} = makeTransport(send);
    const service = new PianoService(transport);
    service.setEngine(new FP30XEngine());

    const result = await service.assignChannelTone(5, concertPiano);

    expect(result).toEqual({
      status: 'refused',
      channel: 5,
      reason: 'send-failed',
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(useMidiChannelStore.getState().assignments).toEqual({});
  });

  it('never rejects — failure is always a returned value', async () => {
    const send = jest.fn().mockRejectedValue(new Error('BLE gone'));
    const {transport} = makeTransport(send);
    const service = new PianoService(transport);
    service.setEngine(new FP30XEngine());

    await expect(
      service.assignChannelTone(5, concertPiano),
    ).resolves.toMatchObject({status: 'refused'});
  });
});

describe('PianoService.getChannelToneTargets', () => {
  it('returns all sixteen channels in ascending order', () => {
    const {transport} = makeTransport();
    const service = new PianoService(transport);
    service.setEngine(new FP30XEngine());

    const targets = service.getChannelToneTargets(concertPiano);

    expect(targets.map(t => t.channel)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
  });

  it('marks channel 4 and, for a melodic tone, channel 10 ineligible', () => {
    const {transport} = makeTransport();
    const service = new PianoService(transport);
    service.setEngine(new FP30XEngine());

    const melodic = service.getChannelToneTargets(concertPiano);
    expect(melodic.find(t => t.channel === 4)).toEqual({
      channel: 4,
      eligible: false,
      reason: 'keyboard-channel',
    });
    expect(melodic.find(t => t.channel === 10)).toEqual({
      channel: 10,
      eligible: false,
      reason: 'requires-drum-kit',
    });
    expect(melodic.filter(t => t.eligible)).toHaveLength(14);

    const kit = service.getChannelToneTargets(standardSet);
    expect(kit.find(t => t.channel === 10)).toEqual({
      channel: 10,
      eligible: true,
      reason: null,
    });
    expect(kit.filter(t => t.eligible)).toHaveLength(15);
  });

  it('carries the reason the engine returned rather than re-deriving it', () => {
    const {transport} = makeTransport();
    const service = new PianoService(transport);
    const engine = new FP30XEngine();
    jest
      .spyOn(engine, 'planChannelToneChange')
      .mockReturnValue({eligible: false, reason: 'tone-not-assignable'});
    service.setEngine(engine);

    const targets = service.getChannelToneTargets(concertPiano);

    expect(targets).toHaveLength(16);
    expect(new Set(targets.map(t => t.reason))).toEqual(
      new Set(['tone-not-assignable']),
    );
  });

  it('returns an empty list when no engine is resolved', () => {
    const {transport} = makeTransport();
    const service = new PianoService(transport);
    expect(service.getChannelToneTargets(concertPiano)).toEqual([]);
  });
});
