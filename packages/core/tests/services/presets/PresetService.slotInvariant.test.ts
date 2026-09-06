/**
 * Regression guard for the reported repro: Display tab in Split mode with the
 * LOWER tab selected → perform a song → land on a Single-mode scene → exit
 * perform → Display tab showed the stale Split Lower tone.
 *
 * This test pins the causal step in the middle of that chain: a Single-mode
 * scene recall goes through `applySnapshot`, which moves
 * `performanceStore.voiceMode` to Single but deliberately leaves the persisted
 * `appSettingsStore.activeToneSlot` alone. Consumers must therefore not read
 * the stored slot raw — `resolveActiveToneSlot` derives the addressable slot
 * from the live mode, which is what `useTones` / `useVoicingMode` use.
 */
import {PresetService} from '../../../src/services/presets/PresetService';
import {PianoService} from '../../../src/services/PianoService';
import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {
  createPerformanceStore,
  usePerformanceStore,
} from '../../../src/store/performanceStore';
import {
  createAppSettingsStore,
  useAppSettingsStore,
} from '../../../src/store/appSettingsStore';
import {inMemoryStorage} from '../../../src/store/storage';
import {
  VOICING_MODE_TO_BYTE,
  byteToVoicingMode,
  resolveActiveToneSlot,
} from '../../../src/helpers/voicingMode';
import type {Transport} from '../../../src/transport/types';
import {
  DEFAULT_PERFORMANCE_SNAPSHOT,
  type PerformanceSnapshot,
} from '../../../src/types/performanceSnapshot';

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

const SINGLE_SCENE: PerformanceSnapshot = {
  ...DEFAULT_PERFORMANCE_SNAPSHOT,
  voiceModeSnapshot: {
    ...DEFAULT_PERFORMANCE_SNAPSHOT.voiceModeSnapshot,
    voiceMode: 'single',
    rightToneId: 'sn-piano-0-0',
  },
};

beforeAll(() => {
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
});

describe('Single-mode scene recall vs. the persisted tone slot', () => {
  it('never repairs the stored slot, so the effective slot must be derived', async () => {
    const transport = new FakeTransport();
    const pianoService = new PianoService(transport);
    pianoService.setEngine(new FP30XEngine());
    const service = new PresetService(pianoService);

    // Display tab in Split mode with the LOWER tab selected.
    usePerformanceStore.getState().resetPerformance();
    usePerformanceStore.getState().setVoiceMode(VOICING_MODE_TO_BYTE.split);
    useAppSettingsStore.getState().setActiveToneSlot('left');

    // Perform mode lands on a Single-mode scene.
    await service.applySnapshot(SINGLE_SCENE);
    expect(useAppSettingsStore.getState().activeToneSlot).toBe('left');

    // The hardware-authoritative RQ1 read-back confirms Single mode through
    // the same inbound path the app uses — which also leaves the slot alone.
    pianoService.dispatchEvent({
      type: 'voiceMode',
      value: VOICING_MODE_TO_BYTE.single,
    });
    expect(useAppSettingsStore.getState().activeToneSlot).toBe('left');

    // Reading the stored slot raw would address the Split Lower tone in
    // Single mode. Deriving from the live mode is what keeps the tone panel
    // and the Library sidebar honest.
    const mode = byteToVoicingMode(
      usePerformanceStore.getState().voiceMode ?? 0,
    );
    expect(mode).toBe('single');
    expect(
      resolveActiveToneSlot(
        mode!,
        useAppSettingsStore.getState().activeToneSlot,
      ),
    ).toBe('right');
  });
});
