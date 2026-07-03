/**
 * T024: Performance store tests.
 *
 * Verifies tone history push/undo, undo with empty history,
 * setActiveTone clears pendingTone, volume/tempo set.
 */

import {usePerformanceStore, createPerformanceStore} from '../../src/store/performanceStore';
import {inMemoryStorage} from '../../src/store/storage';

beforeAll(() => {
  createPerformanceStore({storage: inMemoryStorage});
});

const concertPiano = {
  id: '0-0-0',
  name: 'Concert Piano',
  category: 0,
  categoryName: 'Piano',
  indexHigh: 0,
  indexLow: 0,
  position: 0,
  isGM2: false,
};

const epicStrings = {
  id: '3-0-0',
  name: 'Epic Strings',
  category: 3,
  categoryName: 'Strings',
  indexHigh: 0,
  indexLow: 0,
  position: 0,
  isGM2: false,
};

const brightPiano = {
  id: '0-0-3',
  name: 'Bright Piano',
  category: 0,
  categoryName: 'Piano',
  indexHigh: 0,
  indexLow: 3,
  position: 3,
  isGM2: false,
};

beforeEach(() => {
  usePerformanceStore.getState().resetPerformance();
});

describe('performanceStore', () => {
  describe('initial state', () => {
    it('has no active tone', () => {
      expect(usePerformanceStore.getState().activeTone).toBeNull();
    });

    it('has empty tone history', () => {
      expect(usePerformanceStore.getState().toneHistory).toHaveLength(0);
    });

    it('has default volume 100', () => {
      expect(usePerformanceStore.getState().volume).toBe(100);
    });

    it('has default tempo 120', () => {
      expect(usePerformanceStore.getState().tempo).toBe(120);
    });

    it('has metronome off', () => {
      expect(usePerformanceStore.getState().metronomeOn).toBe(false);
    });

    it('has default beat 4/4 (value 3)', () => {
      expect(usePerformanceStore.getState().metronomeBeat).toBe(3);
    });

    it('has headphonesConnected initially null (unknown until first read)', () => {
      expect(usePerformanceStore.getState().headphonesConnected).toBeNull();
    });
  });

  describe('setActiveTone', () => {
    it('sets the active tone', () => {
      usePerformanceStore.getState().setActiveTone(concertPiano);
      expect(usePerformanceStore.getState().activeTone).toEqual(concertPiano);
    });

    it('pushes previous tone to history', () => {
      usePerformanceStore.getState().setActiveTone(concertPiano);
      usePerformanceStore.getState().setActiveTone(epicStrings);

      const state = usePerformanceStore.getState();
      expect(state.activeTone).toEqual(epicStrings);
      expect(state.toneHistory).toHaveLength(1);
      expect(state.toneHistory[0]).toEqual(concertPiano);
    });

    it('clears pending tone when setting active', () => {
      usePerformanceStore.getState().setPendingTone(concertPiano);
      expect(usePerformanceStore.getState().pendingTone).toEqual(concertPiano);

      usePerformanceStore.getState().setActiveTone(epicStrings);
      expect(usePerformanceStore.getState().pendingTone).toBeNull();
    });

    it('builds history across multiple changes', () => {
      usePerformanceStore.getState().setActiveTone(concertPiano);
      usePerformanceStore.getState().setActiveTone(epicStrings);
      usePerformanceStore.getState().setActiveTone(brightPiano);

      const state = usePerformanceStore.getState();
      expect(state.activeTone).toEqual(brightPiano);
      expect(state.toneHistory).toHaveLength(2);
      expect(state.toneHistory[0]).toEqual(concertPiano);
      expect(state.toneHistory[1]).toEqual(epicStrings);
    });
  });

  describe('undo', () => {
    it('returns null when history is empty', () => {
      const result = usePerformanceStore.getState().undo();
      expect(result).toBeNull();
    });

    it('pops the last tone from history', () => {
      usePerformanceStore.getState().setActiveTone(concertPiano);
      usePerformanceStore.getState().setActiveTone(epicStrings);

      const result = usePerformanceStore.getState().undo();
      expect(result).toEqual(concertPiano);
      expect(usePerformanceStore.getState().activeTone).toEqual(concertPiano);
      expect(usePerformanceStore.getState().toneHistory).toHaveLength(0);
    });

    it('supports multiple undos', () => {
      usePerformanceStore.getState().setActiveTone(concertPiano);
      usePerformanceStore.getState().setActiveTone(epicStrings);
      usePerformanceStore.getState().setActiveTone(brightPiano);

      usePerformanceStore.getState().undo();
      expect(usePerformanceStore.getState().activeTone).toEqual(epicStrings);

      usePerformanceStore.getState().undo();
      expect(usePerformanceStore.getState().activeTone).toEqual(concertPiano);

      const result = usePerformanceStore.getState().undo();
      expect(result).toBeNull();
    });
  });

  describe('volume', () => {
    it('sets volume', () => {
      usePerformanceStore.getState().setVolume(80);
      expect(usePerformanceStore.getState().volume).toBe(80);
    });
  });

  describe('tempo', () => {
    it('sets tempo', () => {
      usePerformanceStore.getState().setTempo(140);
      expect(usePerformanceStore.getState().tempo).toBe(140);
    });
  });

  describe('metronome', () => {
    it('sets metronome on', () => {
      usePerformanceStore.getState().setMetronomeOn(true);
      expect(usePerformanceStore.getState().metronomeOn).toBe(true);
    });

    it('sets metronome beat', () => {
      usePerformanceStore.getState().setMetronomeBeat(2);
      expect(usePerformanceStore.getState().metronomeBeat).toBe(2);
    });
  });

  describe('headphones', () => {
    it('round-trips true then false', () => {
      const store = usePerformanceStore.getState();
      store.setHeadphonesConnected(true);
      expect(usePerformanceStore.getState().headphonesConnected).toBe(true);
      store.setHeadphonesConnected(false);
      expect(usePerformanceStore.getState().headphonesConnected).toBe(false);
    });
  });

  describe('per-slot tone history', () => {
    it('pushes prior leftTone to leftToneHistory when set', () => {
      const store = usePerformanceStore.getState();
      store.setLeftTone(concertPiano);
      store.setLeftTone(epicStrings);
      const state = usePerformanceStore.getState();
      expect(state.leftTone).toEqual(epicStrings);
      expect(state.leftToneHistory).toHaveLength(1);
      expect(state.leftToneHistory[0]).toEqual(concertPiano);
    });

    it('does not push to leftToneHistory when prior is null', () => {
      usePerformanceStore.getState().setLeftTone(concertPiano);
      expect(usePerformanceStore.getState().leftToneHistory).toHaveLength(0);
    });

    it('does not push to leftToneHistory when clearing (null)', () => {
      const store = usePerformanceStore.getState();
      store.setLeftTone(concertPiano);
      store.setLeftTone(null);
      // Clearing must not generate an undo step — undoing a "clear" would
      // re-apply the cleared tone unexpectedly.
      expect(usePerformanceStore.getState().leftToneHistory).toHaveLength(0);
    });

    it('undoLeftTone restores previous tone', () => {
      const store = usePerformanceStore.getState();
      store.setLeftTone(concertPiano);
      store.setLeftTone(epicStrings);
      const result = usePerformanceStore.getState().undoLeftTone();
      expect(result).toEqual(concertPiano);
      const state = usePerformanceStore.getState();
      expect(state.leftTone).toEqual(concertPiano);
      expect(state.leftToneHistory).toHaveLength(0);
    });

    it('undoLeftTone returns null when history is empty', () => {
      expect(usePerformanceStore.getState().undoLeftTone()).toBeNull();
    });

    it('pushes prior dualTone2 to dualTone2History when set', () => {
      const store = usePerformanceStore.getState();
      store.setDualTone2(concertPiano);
      store.setDualTone2(brightPiano);
      const state = usePerformanceStore.getState();
      expect(state.dualTone2).toEqual(brightPiano);
      expect(state.dualTone2History).toHaveLength(1);
      expect(state.dualTone2History[0]).toEqual(concertPiano);
    });

    it('undoDualTone2 restores previous tone', () => {
      const store = usePerformanceStore.getState();
      store.setDualTone2(concertPiano);
      store.setDualTone2(brightPiano);
      const result = usePerformanceStore.getState().undoDualTone2();
      expect(result).toEqual(concertPiano);
      const state = usePerformanceStore.getState();
      expect(state.dualTone2).toEqual(concertPiano);
      expect(state.dualTone2History).toHaveLength(0);
    });

    it('undoDualTone2 returns null when history is empty', () => {
      expect(usePerformanceStore.getState().undoDualTone2()).toBeNull();
    });

    it('right and left histories are independent', () => {
      const store = usePerformanceStore.getState();
      store.setActiveTone(concertPiano);
      store.setActiveTone(brightPiano);
      store.setLeftTone(concertPiano);
      store.setLeftTone(epicStrings);

      // Undo right — leaves left untouched.
      usePerformanceStore.getState().undo();
      const state = usePerformanceStore.getState();
      expect(state.activeTone).toEqual(concertPiano);
      expect(state.leftTone).toEqual(epicStrings);
      expect(state.leftToneHistory).toHaveLength(1);
    });
  });

  describe('resetPerformance', () => {
    it('resets all state to defaults', () => {
      usePerformanceStore.getState().setActiveTone(concertPiano);
      usePerformanceStore.getState().setVolume(50);
      usePerformanceStore.getState().setTempo(200);
      usePerformanceStore.getState().setMetronomeOn(true);
      usePerformanceStore.getState().setHeadphonesConnected(true);

      usePerformanceStore.getState().resetPerformance();

      const state = usePerformanceStore.getState();
      expect(state.activeTone).toBeNull();
      expect(state.toneHistory).toHaveLength(0);
      expect(state.volume).toBe(100);
      expect(state.tempo).toBe(120);
      expect(state.metronomeOn).toBe(false);
      expect(state.headphonesConnected).toBeNull();
    });
  });
});
