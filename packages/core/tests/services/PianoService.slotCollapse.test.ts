/**
 * Characterization tests for the tone-slot collapse in `PianoService`.
 *
 * These pin the *existing* behaviour of the two write sites that reset
 * `appSettingsStore.activeToneSlot` on Single/Twin entry, so that expressing
 * their predicate through the shared `hasLeftToneSlot` helper is provably
 * behaviour-preserving rather than merely believed to be.
 *
 * The correctness of what the UI *displays* does not depend on these writes —
 * that is derived via `resolveActiveToneSlot`. These only decide which tab is
 * preselected the next time the user enters Split/Dual.
 */
import {PianoService} from '../../src/services/PianoService';
import {
  usePerformanceStore,
  createPerformanceStore,
} from '../../src/store/performanceStore';
import {
  useAppSettingsStore,
  createAppSettingsStore,
} from '../../src/store/appSettingsStore';
import {inMemoryStorage} from '../../src/store/storage';
import {FP30XEngine} from '../../src/engine/fp30x/FP30XEngine';
import type {Transport} from '../../src/transport/types';
import type {QuickToneSlot} from '../../src/types/quickToneSlot';

function makeService() {
  const transport: Transport = {
    status: 'idle',
    send: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockReturnValue(() => {}),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    scan: jest.fn().mockResolvedValue(undefined),
    stopScan: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PianoService(transport);
  service.setEngine(new FP30XEngine());
  return service;
}

function quickSlot(voiceMode: QuickToneSlot['voiceMode']): QuickToneSlot {
  return {voiceMode, rightToneId: null, leftToneId: null, dualTone2Id: null};
}

beforeAll(() => {
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
});

beforeEach(() => {
  usePerformanceStore.getState().setVoiceMode(0);
  useAppSettingsStore.getState().setActiveToneSlot('left');
});

describe('changeVoiceMode collapses the stored slot', () => {
  it.each(['single', 'twin'] as const)(
    'resets the stored slot to right on %s entry',
    async mode => {
      await makeService().changeVoiceMode(mode);
      expect(useAppSettingsStore.getState().activeToneSlot).toBe('right');
    },
  );

  it.each(['split', 'dual'] as const)(
    'leaves the stored slot alone on %s entry',
    async mode => {
      await makeService().changeVoiceMode(mode);
      expect(useAppSettingsStore.getState().activeToneSlot).toBe('left');
    },
  );
});

describe('applyQuickToneSlot collapses the stored slot', () => {
  it.each(['single', 'twin'] as const)(
    'resets the stored slot to right for a %s slot',
    async mode => {
      await makeService().applyQuickToneSlot(quickSlot(mode));
      expect(useAppSettingsStore.getState().activeToneSlot).toBe('right');
    },
  );

  it.each(['split', 'dual'] as const)(
    'leaves the stored slot alone for a %s slot',
    async mode => {
      await makeService().applyQuickToneSlot(quickSlot(mode));
      expect(useAppSettingsStore.getState().activeToneSlot).toBe('left');
    },
  );
});
