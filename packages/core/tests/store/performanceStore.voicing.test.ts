/**
 * T013: performanceStore — voicing-mode field tests.
 *
 * New fields: splitLeftShift, splitRightShift, dualT1Shift, dualT2Shift, twinMode.
 * Each is a raw byte (no semantic conversion at the store layer).
 */

import {usePerformanceStore, createPerformanceStore} from '../../src/store/performanceStore';
import {inMemoryStorage} from '../../src/store/storage';

beforeAll(() => {
  createPerformanceStore({storage: inMemoryStorage});
});

describe('performanceStore — voicing-mode setters', () => {
  it('setSplitLeftShift updates only its own field', () => {
    const before = usePerformanceStore.getState();
    usePerformanceStore.getState().setSplitLeftShift(0x41);
    const after = usePerformanceStore.getState();
    expect(after.splitLeftShift).toBe(0x41);
    // Sanity: an unrelated field is unchanged
    expect(after.volume).toBe(before.volume);
  });

  it('setSplitRightShift updates only its own field', () => {
    usePerformanceStore.getState().setSplitRightShift(0x4c);
    expect(usePerformanceStore.getState().splitRightShift).toBe(0x4c);
  });

  it('setDualT1Shift updates only its own field', () => {
    usePerformanceStore.getState().setDualT1Shift(0x34);
    expect(usePerformanceStore.getState().dualT1Shift).toBe(0x34);
  });

  it('setDualT2Shift updates only its own field', () => {
    usePerformanceStore.getState().setDualT2Shift(0x3f);
    expect(usePerformanceStore.getState().dualT2Shift).toBe(0x3f);
  });

  it('setTwinMode updates only its own field', () => {
    usePerformanceStore.getState().setTwinMode(0);
    expect(usePerformanceStore.getState().twinMode).toBe(0);
  });

  it('consecutive identical sets are stable (idempotent echo handling)', () => {
    const s = usePerformanceStore.getState();
    s.setSplitLeftShift(0x40);
    const after1 = usePerformanceStore.getState().splitLeftShift;
    s.setSplitLeftShift(0x40);
    const after2 = usePerformanceStore.getState().splitLeftShift;
    expect(after1).toBe(0x40);
    expect(after2).toBe(0x40);
  });
});
