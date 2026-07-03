/**
 * T100 / T200: PianoService — voicing-mode + voicing-param tests.
 *
 * Verifies that changeVoiceMode, changeLeftTone, changeSplitPoint,
 * changeBalance, changeShift produce the correct DT1 SysEx via the
 * engine and forward to the transport.
 *
 * Twin entry must dispatch two writes in order: Pair (01 00 02 06 00) then
 * voice-mode (01 00 02 00 03).
 */

import {PianoService} from '../../src/services/PianoService';
import {usePerformanceStore, createPerformanceStore} from '../../src/store/performanceStore';
import {createAppSettingsStore} from '../../src/store/appSettingsStore';
import {inMemoryStorage} from '../../src/store/storage';
import {FP30XEngine} from '../../src/engine/fp30x/FP30XEngine';
import type {Transport} from '../../src/transport/types';
import type {Tone} from '../../src/types/types';

beforeAll(() => {
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
});

beforeEach(() => {
  // Earlier tests can stamp voiceMode (e.g. by calling changeVoiceMode('dual')),
  // which the singleton store keeps. PianoService.changeBalance now routes by
  // current voice mode, so we must start each test from a known-Single state.
  usePerformanceStore.getState().setVoiceMode(0); // Single
});

function makeService() {
  const sent: number[][] = [];
  const transport: Transport = {
    status: 'idle',
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
  const engine = new FP30XEngine();
  const service = new PianoService(transport);
  service.setEngine(engine);
  return {service, sent, engine, transport};
}

/** Drain the 50ms debounce timers used by PianoService. */
async function flushDebounce() {
  await new Promise(r => setTimeout(r, 70));
}

describe('PianoService.changeVoiceMode', () => {
  it('Single sends one DT1 to 01 00 02 00 with byte 0x00', async () => {
    const {service, sent} = makeService();
    await service.changeVoiceMode('single');
    await flushDebounce();
    expect(sent.length).toBe(1);
    const m = sent[0];
    expect(m[8]).toBe(0x01); // addr[0]
    expect(m[11]).toBe(0x00); // addr[3]
    expect(m[12]).toBe(0x00); // data byte (Single)
  });

  it('Dual sends one DT1 to 01 00 02 00 with byte 0x02', async () => {
    const {service, sent} = makeService();
    await service.changeVoiceMode('dual');
    await flushDebounce();
    expect(sent.length).toBe(1);
    expect(sent[0][12]).toBe(0x02);
  });

  it('Split sends one DT1 with byte 0x01', async () => {
    const {service, sent} = makeService();
    await service.changeVoiceMode('split');
    await flushDebounce();
    expect(sent.length).toBe(1);
    expect(sent[0][12]).toBe(0x01);
  });

  it('Twin dispatches Pair (01 00 02 06 00) THEN voice-mode (01 00 02 00 03)', async () => {
    const {service, sent} = makeService();
    await service.changeVoiceMode('twin');
    await flushDebounce();
    expect(sent.length).toBe(2);
    // First message: pair-mode write
    expect(sent[0][8]).toBe(0x01);
    expect(sent[0][11]).toBe(0x06);
    expect(sent[0][12]).toBe(0x00);
    // Second message: voice-mode write
    expect(sent[1][8]).toBe(0x01);
    expect(sent[1][11]).toBe(0x00);
    expect(sent[1][12]).toBe(0x03);
  });

  it('updates store.voiceMode optimistically', async () => {
    const {service} = makeService();
    await service.changeVoiceMode('dual');
    expect(usePerformanceStore.getState().voiceMode).toBe(0x02);
    await flushDebounce();
  });
});

describe('PianoService.changeLeftTone', () => {
  it('sends DT1 to 01 00 02 0A with the tone bytes', async () => {
    const {service, sent} = makeService();
    const tone: Tone = {
      id: 'sn-strings-1',
      name: 'Strings 1',
      category: 0x03,
      categoryName: 'Strings',
      indexHigh: 0,
      indexLow: 0,
      position: 0,
      isGM2: false,
    };
    await service.changeLeftTone(tone);
    await flushDebounce();
    expect(sent.length).toBe(1);
    expect(sent[0][11]).toBe(0x0a);
    expect(sent[0][12]).toBe(0x03); // category
  });
});

describe('PianoService.changeDualTone2', () => {
  it('sends DT1 to 01 00 02 0D with the tone bytes', async () => {
    const {service, sent} = makeService();
    const tone: Tone = {
      id: 'sn-strings-1',
      name: 'Strings 1',
      category: 0x03,
      categoryName: 'Strings',
      indexHigh: 0,
      indexLow: 0,
      position: 0,
      isGM2: false,
    };
    await service.changeDualTone2(tone);
    await flushDebounce();
    expect(sent.length).toBe(1);
    expect(sent[0][11]).toBe(0x0d);
    expect(sent[0][12]).toBe(0x03); // category
  });
});

describe('PianoService.changeSplitPoint', () => {
  it('sends DT1 to 01 00 02 01 with the note byte (debounced)', async () => {
    const {service, sent} = makeService();
    await service.changeSplitPoint(54); // F#3
    await service.changeSplitPoint(55); // last write wins (debounce)
    await flushDebounce();
    expect(sent.length).toBe(1);
    expect(sent[0][11]).toBe(0x01);
    expect(sent[0][12]).toBe(55);
  });
});

describe('PianoService.changeBalance', () => {
  it('writes to 01 00 02 03 (Split address) by default', async () => {
    const {service, sent} = makeService();
    await service.changeBalance(70);
    await service.changeBalance(80);
    await flushDebounce();
    expect(sent.length).toBe(1);
    expect(sent[0][11]).toBe(0x03);
    expect(sent[0][12]).toBe(80);
  });

  it('routes to 01 00 02 05 (Dual address) when voice mode is Dual', async () => {
    const {service, sent} = makeService();
    await service.changeVoiceMode('dual');
    await flushDebounce();
    sent.length = 0; // drop the mode-change write
    await service.changeBalance(72);
    await flushDebounce();
    expect(sent.length).toBe(1);
    expect(sent[0][11]).toBe(0x05);
    expect(sent[0][12]).toBe(72);
  });
});

describe('PianoService.changeShift (unit = octaves)', () => {
  it('sends DT1 to 01 00 02 17 with 0x43 for dual-tone1 +3 octaves', async () => {
    const {service, sent} = makeService();
    await service.changeShift('dual-tone1', 3);
    await flushDebounce();
    expect(sent.length).toBe(1);
    expect(sent[0][11]).toBe(0x17);
    expect(sent[0][12]).toBe(0x43);
  });

  it('sends DT1 to 01 00 02 02 with 0x3F for split-left -1 octave', async () => {
    const {service, sent} = makeService();
    await service.changeShift('split-left', -1);
    await flushDebounce();
    expect(sent.length).toBe(1);
    expect(sent[0][11]).toBe(0x02);
    expect(sent[0][12]).toBe(0x3f);
  });

  it('debounces — two rapid calls produce one send with the last value', async () => {
    const {service, sent} = makeService();
    await service.changeShift('dual-tone1', 1);
    await service.changeShift('dual-tone1', 2);
    await flushDebounce();
    expect(sent.length).toBe(1);
    expect(sent[0][12]).toBe(0x42); // +2 -> 0x40 + 2
  });
});
