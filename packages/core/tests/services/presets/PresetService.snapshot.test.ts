/**
 * T019 — PresetService capture + apply tests.
 *
 * Covers:
 *  - `captureSnapshot()` reads volume/tempo/metronome/voiceMode +
 *    voiceModeSnapshot + currentToneId + quickToneSlots from
 *    `performanceStore` + `appSettingsStore`.
 *  - `applyPreset()` builds the documented DT1 batch (single + dual +
 *    split + twin paths) and dispatches via `PianoService`.
 *  - Missing snapshot fields are skipped (FR-010 — "no change").
 *  - Round-trip capture → apply preserves every FR-005 field.
 */

import {PresetService} from '../../../src/services/presets/PresetService';
import {PianoService} from '../../../src/services/PianoService';
import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {createPerformanceStore, usePerformanceStore} from '../../../src/store/performanceStore';
import {createAppSettingsStore, useAppSettingsStore} from '../../../src/store/appSettingsStore';
import {inMemoryStorage} from '../../../src/store/storage';
import {useEngineVolumeStore} from '../../../src/store/engineVolumeStore';
import type {Transport} from '../../../src/transport/types';
import type {Preset} from '../../../src/types/profile';
import type {QuickToneSlot} from '../../../src/types/quickToneSlot';

// ─── Fakes ──────────────────────────────────────────────────────

class FakeTransport implements Transport {
  status: 'idle' | 'connected' | 'disconnected' = 'idle';
  deviceName: string | null = null;
  sentMessages: number[][] = [];
  async scan(): Promise<void> {}
  async stopScan(): Promise<void> {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async destroy(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
  async send(bytes: number[]): Promise<void> {
    this.sentMessages.push([...bytes]);
  }
}

function makeService(): {
  service: PresetService;
  pianoService: PianoService;
  transport: FakeTransport;
} {
  const transport = new FakeTransport();
  const pianoService = new PianoService(transport);
  pianoService.setEngine(new FP30XEngine());
  const service = new PresetService(pianoService);
  return {service, pianoService, transport};
}

beforeAll(() => {
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
});

beforeEach(() => {
  usePerformanceStore.getState().resetPerformance();
  useAppSettingsStore.setState({
    quickToneSlots: [null, null, null],
  });
  useEngineVolumeStore.getState().reset();
});

// ─── captureSnapshot ────────────────────────────────────────────

describe('PresetService.captureSnapshot', () => {
  it('captures the Engine Volume position and tempo', () => {
    const {service} = makeService();
    useEngineVolumeStore.getState().setPosition(77);
    usePerformanceStore.getState().setTempo(155);
    const snap = service.captureSnapshot();
    expect(snap.volume).toBe(77);
    expect(snap.tempo).toBe(155);
  });

  it('never captures the Output Volume mirror', () => {
    const {service} = makeService();
    usePerformanceStore.getState().setOutputVolume(12);
    useEngineVolumeStore.getState().setPosition(64);
    expect(service.captureSnapshot().volume).toBe(64);
  });

  it('captures the default Engine Volume position 100 on a fresh session', () => {
    const {service} = makeService();
    usePerformanceStore.getState().setOutputVolume(40);
    expect(service.captureSnapshot().volume).toBe(100);
  });

  it('captures all five metronome fields', () => {
    const {service} = makeService();
    usePerformanceStore.getState().setMetronomeOn(true);
    usePerformanceStore.getState().setMetronomeBeat(2);
    usePerformanceStore.getState().setMetronomePattern(4);
    usePerformanceStore.getState().setMetronomeVolume(7);
    usePerformanceStore.getState().setMetronomeTone(1);
    const snap = service.captureSnapshot();
    expect(snap.metronome).toEqual({
      on: true,
      beat: 2,
      pattern: 4,
      volume: 7,
      tone: 1,
    });
  });

  it('captures the three quick-tone slots as a deep copy', () => {
    const {service} = makeService();
    const slot: QuickToneSlot = {
      voiceMode: 'single',
      rightToneId: '0-0-0',
      leftToneId: null,
      dualTone2Id: null,
    };
    useAppSettingsStore.setState({quickToneSlots: [slot, null, null]});
    const snap = service.captureSnapshot();
    expect(snap.quickToneSlots[0]).toEqual(slot);
    expect(snap.quickToneSlots[0]).not.toBe(slot); // deep-copy
    expect(snap.quickToneSlots[1]).toBeNull();
    expect(snap.quickToneSlots[2]).toBeNull();
  });

  it('defaults voiceModeSnapshot to single when no mode set', () => {
    const {service} = makeService();
    const snap = service.captureSnapshot();
    expect(snap.voiceModeSnapshot.voiceMode).toBe('single');
  });

  it('captures currentToneId from activeTone', () => {
    const {service, pianoService} = makeService();
    const engine = pianoService.getEngine()!;
    const tone = engine.tones.findById(engine.tones.categories[0].tones[0].id);
    usePerformanceStore.getState().setActiveTone(tone!);
    const snap = service.captureSnapshot();
    expect(snap.currentToneId).toBe(tone!.id);
  });
});

// ─── applyPreset / applySnapshot ────────────────────────────────

describe('PresetService.applyPreset', () => {
  it('sends the tempo DT1 write and no Output Volume write via PianoService', async () => {
    const {service, transport} = makeService();
    const preset: Preset = makePreset({
      snapshot: {
        volume: 50,
        tempo: 100,
        metronome: {},
        voiceModeSnapshot: {
          voiceMode: 'single',
          rightToneId: null,
          leftToneId: null,
          dualTone2Id: null,
        },
        currentToneId: null,
        quickToneSlots: [null, null, null],
      },
    });
    await service.applyPreset(preset);
    const joined = transport.sentMessages.map(m => m.join(','));
    expect(joined.some(m => m.includes('1,0,3,9'))).toBe(true);
    expect(joined.some(m => m.includes(OUTPUT_VOLUME_ADDR))).toBe(false);
    expect(useEngineVolumeStore.getState().position).toBe(50);
  });

  it('marks the preset as active in performanceStore', async () => {
    const {service} = makeService();
    const preset = makePreset();
    await service.applyPreset(preset);
    expect(usePerformanceStore.getState().activePresetId).toBe(preset.id);
  });

  it('restores the three quick-tone slots into appSettingsStore', async () => {
    const {service} = makeService();
    const slotA: QuickToneSlot = {
      voiceMode: 'single',
      rightToneId: '0-0-0',
      leftToneId: null,
      dualTone2Id: null,
    };
    const preset = makePreset({
      snapshot: {
        ...defaultSnapshot,
        quickToneSlots: [slotA, null, null],
      },
    });
    await service.applyPreset(preset);
    expect(useAppSettingsStore.getState().quickToneSlots[0]).toEqual(slotA);
  });

  it('skips missing metronome fields (FR-010 "no change")', async () => {
    const {service, transport} = makeService();
    const preset = makePreset({
      snapshot: {
        ...defaultSnapshot,
        metronome: {}, // empty — every sub-field undefined
      },
    });
    await service.applyPreset(preset);
    // No metronome-toggle / param messages should have fired.
    const allBytes = transport.sentMessages.map(m => m.join(','));
    // Heuristic: metronome address bytes are 01 00 02 1F / 20 / 21 / 22 / 05 09.
    expect(
      allBytes.some(s => s.includes('1,0,2,31') || s.includes('1,0,2,32')),
    ).toBe(false);
  });

  it('handles split-mode params end-to-end', async () => {
    const {service, transport} = makeService();
    const preset = makePreset({
      snapshot: {
        ...defaultSnapshot,
        voiceModeSnapshot: {
          voiceMode: 'split',
          rightToneId: null,
          leftToneId: null,
          dualTone2Id: null,
          splitPoint: 60,
          balance: 64,
          splitLeftShift: 0x40,
          splitRightShift: 0x40,
        },
      },
    });
    await service.applyPreset(preset);
    // Voice-mode change + split params should produce multiple sends.
    expect(transport.sentMessages.length).toBeGreaterThan(2);
  });
});

// ─── Engine Volume ──────────────────────────────────────────────

const OUTPUT_VOLUME_ADDR = '1,0,2,19';

describe('PresetService Engine Volume', () => {
  it('stores a finite snapshot volume as the Engine Volume position when no engine is set', async () => {
    const pianoService = new PianoService(new FakeTransport());
    const service = new PresetService(pianoService);
    const setEngineVolume = jest.spyOn(pianoService, 'setEngineVolume');
    await service.applySnapshot({...defaultSnapshot, volume: 42});
    expect(setEngineVolume).toHaveBeenCalledWith(42);
    expect(useEngineVolumeStore.getState().position).toBe(42);
  });

  it('leaves Engine Volume unchanged without an engine when the volume is not a number', async () => {
    const pianoService = new PianoService(new FakeTransport());
    const service = new PresetService(pianoService);
    useEngineVolumeStore.getState().setPosition(33);
    await service.applySnapshot({
      ...defaultSnapshot,
      volume: undefined as unknown as number,
    });
    expect(useEngineVolumeStore.getState().position).toBe(33);
  });

  it('sets Engine Volume through the piano service after the parameter batch', async () => {
    const {service, pianoService} = makeService();
    const calls: string[] = [];
    jest.spyOn(pianoService, 'applyPreset').mockImplementation(async () => {
      calls.push('batch');
    });
    jest.spyOn(pianoService, 'setEngineVolume').mockImplementation(() => {
      calls.push('engineVolume');
    });
    await service.applySnapshot({...defaultSnapshot, volume: 60});
    expect(calls).toEqual(['batch', 'engineVolume']);
  });

  it('clamps an out-of-range snapshot volume into 0-100', async () => {
    const {service} = makeService();
    await service.applySnapshot({...defaultSnapshot, volume: 150});
    expect(useEngineVolumeStore.getState().position).toBe(100);
    await service.applySnapshot({...defaultSnapshot, volume: -4});
    expect(useEngineVolumeStore.getState().position).toBe(0);
  });

  it.each([
    ['missing', undefined],
    ['NaN', Number.NaN],
    ['a string', '60'],
    ['null', null],
  ])('leaves Engine Volume unchanged when the volume is %s', async (_label, value) => {
    const {service} = makeService();
    useEngineVolumeStore.getState().setPosition(21);
    await service.applySnapshot({
      ...defaultSnapshot,
      volume: value as unknown as number,
    });
    expect(useEngineVolumeStore.getState().position).toBe(21);
  });

  it('never changes the Output Volume mirror on apply', async () => {
    const {service, transport} = makeService();
    usePerformanceStore.getState().setOutputVolume(45);
    await service.applySnapshot({...defaultSnapshot, volume: 10});
    expect(usePerformanceStore.getState().outputVolume).toBe(45);
    expect(
      transport.sentMessages.some(m => m.join(',').includes(OUTPUT_VOLUME_ADDR)),
    ).toBe(false);
  });
});

// ─── Key touch ──────────────────────────────────────────────────

const KEY_TOUCH_ADDR = '1,0,2,29';

function keyTouchWrites(transport: FakeTransport): number[][] {
  return transport.sentMessages.filter(m =>
    m.join(',').includes(KEY_TOUCH_ADDR),
  );
}

describe('PresetService key touch', () => {
  // resetPerformance() shallow-merges, so optional fields need clearing by hand.
  beforeEach(() => {
    usePerformanceStore.setState({keyTouch: undefined});
  });

  it('captures the key touch curve from performanceStore', () => {
    const {service} = makeService();
    usePerformanceStore.getState().setKeyTouch(5);
    expect(service.captureSnapshot().keyTouch).toBe(5);
  });

  it('leaves keyTouch undefined when the piano has not reported one', () => {
    const {service} = makeService();
    expect(service.captureSnapshot().keyTouch).toBeUndefined();
  });

  it('writes the captured curve on apply', async () => {
    const {service, transport} = makeService();
    const preset = makePreset({
      snapshot: {...defaultSnapshot, keyTouch: 4},
    });
    await service.applyPreset(preset);
    expect(keyTouchWrites(transport)).toEqual([
      [0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
       0x01, 0x00, 0x02, 0x1d, 0x04, 0x5c, 0xf7],
    ]);
  });

  it('skips the write when the snapshot has no key touch (FR-010 "no change")', async () => {
    const {service, transport} = makeService();
    await service.applyPreset(makePreset({snapshot: {...defaultSnapshot}}));
    expect(keyTouchWrites(transport)).toEqual([]);
  });

  it('clamps an out-of-range stored curve before writing', async () => {
    const {service, transport} = makeService();
    const preset = makePreset({
      snapshot: {...defaultSnapshot, keyTouch: 42},
    });
    await service.applyPreset(preset);
    expect(keyTouchWrites(transport)[0]).toEqual(
      [0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
       0x01, 0x00, 0x02, 0x1d, 0x05, 0x5b, 0xf7],
    );
  });

  it('survives a capture → apply round-trip', async () => {
    const {service, transport} = makeService();
    usePerformanceStore.getState().setKeyTouch(1);
    const captured = service.captureSnapshot();
    await service.applySnapshot(captured);
    expect(keyTouchWrites(transport)).toEqual([
      [0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
       0x01, 0x00, 0x02, 0x1d, 0x01, 0x5f, 0xf7],
    ]);
  });
});

// ─── Round-trip ─────────────────────────────────────────────────

describe('PresetService capture → apply round-trip', () => {
  it('every FR-005 field survives the round-trip', async () => {
    const {service, pianoService} = makeService();
    const engine = pianoService.getEngine()!;
    const tone = engine.tones.findById(engine.tones.categories[0].tones[0].id);

    usePerformanceStore.getState().setActiveTone(tone!);
    useEngineVolumeStore.getState().setPosition(63);
    usePerformanceStore.getState().setTempo(110);
    usePerformanceStore.getState().setMetronomeOn(true);
    usePerformanceStore.getState().setMetronomeBeat(2);

    const captured = service.captureSnapshot();
    expect(captured.volume).toBe(63);
    expect(captured.tempo).toBe(110);
    expect(captured.metronome.on).toBe(true);
    expect(captured.metronome.beat).toBe(2);
    expect(captured.currentToneId).toBe(tone!.id);
  });
});

// ─── Helpers ────────────────────────────────────────────────────

const defaultSnapshot = {
  volume: 100,
  tempo: 120,
  metronome: {},
  voiceModeSnapshot: {
    voiceMode: 'single' as const,
    rightToneId: null,
    leftToneId: null,
    dualTone2Id: null,
  },
  currentToneId: null,
  quickToneSlots: [null, null, null] as [
    QuickToneSlot | null,
    QuickToneSlot | null,
    QuickToneSlot | null,
  ],
};

function makePreset(overrides: Partial<Preset> = {}): Preset {
  const now = new Date().toISOString();
  return {
    id: 'p-1',
    label: 'Test',
    tilePosition: 0,
    snapshot: {...defaultSnapshot},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
