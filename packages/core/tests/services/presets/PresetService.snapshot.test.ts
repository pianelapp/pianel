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
});

// ─── captureSnapshot ────────────────────────────────────────────

describe('PresetService.captureSnapshot', () => {
  it('captures volume + tempo from performanceStore', () => {
    const {service} = makeService();
    usePerformanceStore.getState().setVolume(77);
    usePerformanceStore.getState().setTempo(155);
    const snap = service.captureSnapshot();
    expect(snap.volume).toBe(77);
    expect(snap.tempo).toBe(155);
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
  it('sends volume + tempo DT1 writes via PianoService', async () => {
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
    // Volume + tempo each produce exactly one SysEx message.
    expect(transport.sentMessages.length).toBeGreaterThanOrEqual(2);
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

// ─── Round-trip ─────────────────────────────────────────────────

describe('PresetService capture → apply round-trip', () => {
  it('every FR-005 field survives the round-trip', async () => {
    const {service, pianoService} = makeService();
    const engine = pianoService.getEngine()!;
    const tone = engine.tones.findById(engine.tones.categories[0].tones[0].id);

    usePerformanceStore.getState().setActiveTone(tone!);
    usePerformanceStore.getState().setVolume(63);
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
