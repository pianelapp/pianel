/**
 * T060: BUG-05 — Category sync on tone notification.
 *
 * When a tone change notification arrives from the piano, PianoService
 * must update lastCategoryIndex in appSettingsStore so the category
 * display stays in sync.
 */

import {PianoService} from '../../src/services/PianoService';
import {usePerformanceStore, createPerformanceStore} from '../../src/store/performanceStore';
import {useAppSettingsStore, createAppSettingsStore} from '../../src/store/appSettingsStore';
import {inMemoryStorage} from '../../src/store/storage';
import type {PianoEngine} from '../../src/engine/IPianoEngine';
import type {Transport} from '../../src/transport/types';
import type {Tone, ToneCategory, ToneCatalog} from '../../src/types/types';

beforeAll(() => {
  createPerformanceStore({storage: inMemoryStorage});
  createAppSettingsStore({storage: inMemoryStorage});
});

// ─── Mock Transport ──────────────────────────────────────────

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

// ─── Mock Tones & Categories ─────────────────────────────────

const pianoTone: Tone = {
  id: 'sn-piano-concert-1',
  name: 'Concert Piano 1',
  category: 0x00,
  categoryName: 'Piano',
  indexHigh: 0,
  indexLow: 0,
  position: 0,
  isGM2: false,
};

const stringsTone: Tone = {
  id: 'sn-strings-1',
  name: 'Strings 1',
  category: 0x03,
  categoryName: 'Strings',
  indexHigh: 0,
  indexLow: 0,
  position: 0,
  isGM2: false,
};

const categories: ToneCategory[] = [
  {id: 0x00, name: 'Piano', tones: [pianoTone]},
  {id: 0x01, name: 'E.Piano', tones: []},
  {id: 0x02, name: 'Organ', tones: []},
  {id: 0x03, name: 'Strings', tones: [stringsTone]},
];

const mockCatalog: ToneCatalog = {
  categories,
  totalCount: 2,
  findByDT1: jest.fn(),
  findById: jest.fn(),
  searchByName: jest.fn().mockReturnValue([]),
  getToneAtPosition: jest.fn(),
};

// ─── Mock Engine ─────────────────────────────────────────────

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

// ─── Tests ───────────────────────────────────────────────────

describe('PianoService category sync (BUG-05)', () => {
  let service: PianoService;

  beforeEach(() => {
    usePerformanceStore.getState().resetPerformance();
    useAppSettingsStore.getState().setLastCategoryIndex(0);

    service = new PianoService(mockTransport);
    service.setEngine(mockEngine);

    // Reset findByDT1 mock for each test
    (mockCatalog.findByDT1 as jest.Mock).mockReset();
  });

  it('updates lastCategoryIndex when tone notification arrives', () => {
    // findByDT1 returns the strings tone (category 0x03, index 3 in categories array)
    (mockCatalog.findByDT1 as jest.Mock).mockReturnValue(stringsTone);

    service.dispatchEvent({
      type: 'tone',
      category: 0x03,
      indexHigh: 0,
      indexLow: 0,
    });

    expect(useAppSettingsStore.getState().lastCategoryIndex).toBe(3);
  });

  it('updates lastCategoryIndex to 0 for Piano category', () => {
    // Start with a non-zero category
    useAppSettingsStore.getState().setLastCategoryIndex(3);
    (mockCatalog.findByDT1 as jest.Mock).mockReturnValue(pianoTone);

    service.dispatchEvent({
      type: 'tone',
      category: 0x00,
      indexHigh: 0,
      indexLow: 0,
    });

    expect(useAppSettingsStore.getState().lastCategoryIndex).toBe(0);
  });

  it('does not update lastCategoryIndex for unknown tones', () => {
    useAppSettingsStore.getState().setLastCategoryIndex(2);
    (mockCatalog.findByDT1 as jest.Mock).mockReturnValue(undefined);

    service.dispatchEvent({
      type: 'tone',
      category: 0x09,
      indexHigh: 0,
      indexLow: 99,
    });

    // Should remain unchanged
    expect(useAppSettingsStore.getState().lastCategoryIndex).toBe(2);
  });

  it('does not update lastCategoryIndex when engine is null', () => {
    useAppSettingsStore.getState().setLastCategoryIndex(1);
    service = new PianoService(mockTransport);
    // No engine set

    service.dispatchEvent({
      type: 'tone',
      category: 0x03,
      indexHigh: 0,
      indexLow: 0,
    });

    expect(useAppSettingsStore.getState().lastCategoryIndex).toBe(1);
  });
});
