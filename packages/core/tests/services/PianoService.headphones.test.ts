/**
 * Tests for PianoService.dispatchEvent — headphonesConnection variant.
 *
 * Verifies that an incoming `{type:'headphonesConnection', connected: X}`
 * event lands on `performanceStore.headphonesConnected` exactly once and
 * does not touch any other field. Phase 1 of the headphone status spec.
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
import type {PianoEngine} from '../../src/engine/IPianoEngine';
import type {Transport} from '../../src/transport/types';
import type {ToneCatalog} from '../../src/types/types';

beforeAll(() => {
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
});

const mockTransport: Transport = {
  status: 'idle',
  send: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockReturnValue(() => {}),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  scan: jest.fn().mockResolvedValue(undefined),
  stopScan: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
};

const mockCatalog: ToneCatalog = {
  categories: [],
  totalCount: 0,
  findByDT1: jest.fn(),
  findById: jest.fn(),
  searchByName: jest.fn().mockReturnValue([]),
  getToneAtPosition: jest.fn(),
};

const mockEngine: PianoEngine = {
  modelName: 'Roland FP-30X',
  tones: mockCatalog,
  buildToneChange: jest.fn().mockReturnValue([]),
  buildVolumeChange: jest.fn().mockReturnValue([]),
  buildTempoChange: jest.fn().mockReturnValue([]),
  buildMetronomeToggle: jest.fn().mockReturnValue([]),
  buildMetronomeParam: jest.fn().mockReturnValue([]),
  buildVoiceModeChange: jest.fn().mockReturnValue([]),
  buildLeftToneChange: jest.fn().mockReturnValue([]),
  buildDualTone2Change: jest.fn().mockReturnValue([]),
  buildSplitPointChange: jest.fn().mockReturnValue([]),
  buildBalanceChange: jest.fn().mockReturnValue([]),
  buildDualBalanceChange: jest.fn().mockReturnValue([]),
  buildTransposeChange: jest.fn().mockReturnValue([]),
  buildKeyTouchChange: jest.fn().mockReturnValue([]),
  buildShiftChange: jest.fn().mockReturnValue([]),
  buildTwinModeSet: jest.fn().mockReturnValue([]),
  buildSessionUnlock: jest.fn().mockReturnValue([]),
  buildInitialStateRequest: jest.fn().mockReturnValue([]),
  buildIdentityRequest: jest.fn().mockReturnValue([]),
  buildAliveCheck: jest.fn().mockReturnValue([]),
  isAliveReply: jest.fn().mockReturnValue(false),
  parseNotification: jest.fn().mockReturnValue(null),
  parseStateResponse: jest.fn().mockReturnValue([]),
  supportsDevice: jest.fn().mockReturnValue(true),
};

describe('PianoService.dispatchEvent — headphonesConnection', () => {
  let service: PianoService;

  beforeEach(() => {
    usePerformanceStore.getState().resetPerformance();
    service = new PianoService(mockTransport);
    service.setEngine(mockEngine);
  });

  it('flips headphonesConnected to true on a connected event', () => {
    service.dispatchEvent({type: 'headphonesConnection', connected: true});
    expect(usePerformanceStore.getState().headphonesConnected).toBe(true);
  });

  it('flips headphonesConnected to false on a disconnected event', () => {
    service.dispatchEvent({type: 'headphonesConnection', connected: false});
    expect(usePerformanceStore.getState().headphonesConnected).toBe(false);
  });

  it('does not modify unrelated performance fields', () => {
    const before = usePerformanceStore.getState();
    const baseline = {
      volume: before.volume,
      tempo: before.tempo,
      metronomeOn: before.metronomeOn,
      activeTone: before.activeTone,
      voiceMode: before.voiceMode,
    };

    service.dispatchEvent({type: 'headphonesConnection', connected: true});

    const after = usePerformanceStore.getState();
    expect(after.volume).toBe(baseline.volume);
    expect(after.tempo).toBe(baseline.tempo);
    expect(after.metronomeOn).toBe(baseline.metronomeOn);
    expect(after.activeTone).toBe(baseline.activeTone);
    expect(after.voiceMode).toBe(baseline.voiceMode);
  });
});
