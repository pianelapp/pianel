/**
 * Performance Zustand Store.
 *
 * T022: Live mirror of the piano's current state. Updated by both outbound
 * writes (app -> piano) and inbound DT1 notifications (piano -> app).
 * Runtime-only — not persisted.
 *
 * Constitution II: Bidirectional Control Surface — hardware state wins on
 * conflict. This store reflects the authoritative piano state.
 * Constitution IV: DT1 SysEx Protocol Fidelity — all fields map to DT1
 * addresses documented in roland-sysex-discovery.md.
 */

import {create} from 'zustand';
import type {Tone} from '../types/types';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerformanceState {
  /** Currently active tone (full Tone object or null) */
  activeTone: Tone | null;
  /** Tone history stack for undo (Tone 1 / Upper / Single). Most recent at end. Max 50 entries. */
  toneHistory: Tone[];
  /** Tone history stack for the Split Lower slot. Most recent at end. Max 50 entries. */
  leftToneHistory: Tone[];
  /** Tone history stack for the Dual Tone 2 slot. Most recent at end. Max 50 entries. */
  dualTone2History: Tone[];
  /** Currently applied preset ID (null if none) */
  activePresetId: string | null;
  /** Tone queued while disconnected (sent on connect) */
  pendingTone: Tone | null;
  /** Current volume (0-100). DT1 address: 01 00 02 13 */
  volume: number;
  /** Current tempo (BPM 20-250). DT1 address: 01 00 03 09 (2 bytes) */
  tempo: number;
  /** Metronome on/off. Read from: 01 00 01 0F */
  metronomeOn: boolean;
  /** Metronome beat (0=0/4, 1=2/4, 2=3/4, 3=4/4, 4=5/4, 5=6/4).
      DT1 address: 01 00 02 1F */
  metronomeBeat: number;
  /** Metronome pattern (0=Off, 1-7=rhythm subdivisions).
      DT1 address: 01 00 02 20 */
  metronomePattern: number;
  /** Metronome volume (0-10). DT1 address: 01 00 02 21 */
  metronomeVolume: number;
  /** Metronome tone (0=Click, 1=Electronic, 2=Japanese, 3=English).
      DT1 address: 01 00 02 22 */
  metronomeTone: number;
  /** Headphones connection state. `null` until the first DT1 echo at
      01 00 01 10 arrives — runtime-only, not persisted. */
  headphonesConnected: boolean | null;
  /** Voice mode (0=Single, 1=Split, 2=Dual, 3=Twin).
      DT1 address: 01 00 02 00. Phase 3+. */
  voiceMode?: number;
  /** Keyboard transpose (center=64, range 58-69 = -6 to +5).
      DT1 address: 01 00 03 07. Phase 3+. */
  transpose?: number;
  /** Key touch (0=Fix..5=Super Heavy).
      DT1 address: 01 00 02 1D. Phase 3+. */
  keyTouch?: number;
  /** Split point (MIDI note number). Phase 3+. */
  splitPoint?: number;
  /** Split balance raw byte (DT1 01 00 02 03, 56-72, center=64). Phase 3+. */
  balance?: number;
  /** Dual balance raw byte (DT1 01 00 02 05, 56-72, center=64). Separate from
      Split — verified via BLE capture of the Roland Piano App. Phase 3+. */
  dualBalance?: number;
  /** Split Lower tone (DT1 01 00 02 0A). Phase 3+. */
  leftTone?: Tone | null;
  /** Dual Tone 2 (DT1 01 00 02 0D). Separate slot from Split Lower —
      verified via Roland Piano App APK (`toneForDual`). Phase 3+. */
  dualTone2?: Tone | null;
  /** Split — Left Shift raw byte (center=64). DT1: 01 00 02 02. */
  splitLeftShift?: number;
  /** Split — Right Shift raw byte (center=64). DT1: 01 00 02 16. */
  splitRightShift?: number;
  /** Dual — Tone 1 Shift raw byte (center=64). DT1: 01 00 02 17. */
  dualT1Shift?: number;
  /** Dual — Tone 2 Shift raw byte (center=64). DT1: 01 00 02 04. */
  dualT2Shift?: number;
  /** Twin Pair (0) / Individual (1). DT1: 01 00 02 06. App always forces 0. */
  twinMode?: number;
}

export interface PerformanceActions {
  /** Set active tone. Pushes current tone to history (max 50). Clears pending. */
  setActiveTone: (tone: Tone) => void;
  /** Pop the last tone from history, set as active. Returns it, or null if empty. */
  undo: () => Tone | null;
  /** Pop the last left-tone from history, set as leftTone. Returns it, or null if empty. */
  undoLeftTone: () => Tone | null;
  /** Pop the last dual-tone-2 from history, set as dualTone2. Returns it, or null if empty. */
  undoDualTone2: () => Tone | null;
  /** Queue a tone for deferred sending on connect */
  setPendingTone: (tone: Tone) => void;
  /** Clear the pending tone */
  clearPendingTone: () => void;
  /** Set the active preset ID */
  setActivePreset: (presetId: string) => void;
  /** Set volume (0-100) */
  setVolume: (value: number) => void;
  /** Set tempo (BPM 20-250) */
  setTempo: (bpm: number) => void;
  /** Set metronome on/off */
  setMetronomeOn: (on: boolean) => void;
  /** Set metronome beat (0-5) */
  setMetronomeBeat: (value: number) => void;
  /** Set metronome pattern (0-7) */
  setMetronomePattern: (value: number) => void;
  /** Set metronome volume (0-10) */
  setMetronomeVolume: (value: number) => void;
  /** Set metronome tone (0-3) */
  setMetronomeTone: (value: number) => void;
  /** Set headphone-jack connection state from the DT1 echo at 01 00 01 10. */
  setHeadphonesConnected: (connected: boolean) => void;
  /** Set voice mode (0-3). Phase 3+. */
  setVoiceMode: (value: number) => void;
  /** Set transpose (58-69). Phase 3+. */
  setTranspose: (value: number) => void;
  /** Set key touch (0-5). Phase 3+. */
  setKeyTouch: (value: number) => void;
  /** Set split point (MIDI note). Phase 3+. */
  setSplitPoint: (value: number) => void;
  /** Set Split balance raw byte. Phase 3+. */
  setBalance: (value: number) => void;
  /** Set Dual balance raw byte. Phase 3+. */
  setDualBalance: (value: number) => void;
  /** Set Split Lower tone. Phase 3+. */
  setLeftTone: (tone: Tone | null) => void;
  /** Set Dual Tone 2. Phase 3+. */
  setDualTone2: (tone: Tone | null) => void;
  /** Set Split — Left Shift raw byte. */
  setSplitLeftShift: (value: number) => void;
  /** Set Split — Right Shift raw byte. */
  setSplitRightShift: (value: number) => void;
  /** Set Dual — Tone 1 Shift raw byte. */
  setDualT1Shift: (value: number) => void;
  /** Set Dual — Tone 2 Shift raw byte. */
  setDualT2Shift: (value: number) => void;
  /** Set Twin pair/individual raw byte. */
  setTwinMode: (value: number) => void;
  /** Reset all performance state to defaults */
  resetPerformance: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TONE_HISTORY = 50;

const initialState: PerformanceState = {
  activeTone: null,
  toneHistory: [],
  leftTone: null,
  dualTone2: null,
  leftToneHistory: [],
  dualTone2History: [],
  activePresetId: null,
  pendingTone: null,
  volume: 100,
  tempo: 120,
  metronomeOn: false,
  metronomeBeat: 3, // 4/4
  metronomePattern: 0,
  metronomeVolume: 5,
  metronomeTone: 0,
  headphonesConnected: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type StoreType = ReturnType<typeof _build>;
let _store: StoreType | null = null;

function _build() {
  return create<PerformanceState & PerformanceActions>()((set, get) => ({
    ...initialState,

    setActiveTone: (tone) =>
      set((state) => {
        const history = state.activeTone
          ? [...state.toneHistory, state.activeTone].slice(-MAX_TONE_HISTORY)
          : state.toneHistory;
        return {activeTone: tone, toneHistory: history, pendingTone: null};
      }),

    undo: () => {
      const state = get();
      if (state.toneHistory.length === 0) return null;
      const previous = state.toneHistory[state.toneHistory.length - 1];
      set({activeTone: previous, toneHistory: state.toneHistory.slice(0, -1)});
      return previous;
    },

    undoLeftTone: () => {
      const state = get();
      if (state.leftToneHistory.length === 0) return null;
      const previous = state.leftToneHistory[state.leftToneHistory.length - 1];
      set({
        leftTone: previous,
        leftToneHistory: state.leftToneHistory.slice(0, -1),
      });
      return previous;
    },

    undoDualTone2: () => {
      const state = get();
      if (state.dualTone2History.length === 0) return null;
      const previous = state.dualTone2History[state.dualTone2History.length - 1];
      set({
        dualTone2: previous,
        dualTone2History: state.dualTone2History.slice(0, -1),
      });
      return previous;
    },

    setPendingTone: (tone) => set({pendingTone: tone}),
    clearPendingTone: () => set({pendingTone: null}),
    setActivePreset: (presetId) => set({activePresetId: presetId}),
    setVolume: (value) => set({volume: value}),
    setTempo: (bpm) => set({tempo: bpm}),
    setMetronomeOn: (on) => set({metronomeOn: on}),
    setMetronomeBeat: (value) => set({metronomeBeat: value}),
    setMetronomePattern: (value) => set({metronomePattern: value}),
    setMetronomeVolume: (value) => set({metronomeVolume: value}),
    setMetronomeTone: (value) => set({metronomeTone: value}),
    setHeadphonesConnected: (connected) =>
      set({headphonesConnected: connected}),
    setVoiceMode: (value) => set({voiceMode: value}),
    setTranspose: (value) => set({transpose: value}),
    setKeyTouch: (value) => set({keyTouch: value}),
    setSplitPoint: (value) => set({splitPoint: value}),
    setBalance: (value) => set({balance: value}),
    setDualBalance: (value) => set({dualBalance: value}),
    setLeftTone: (tone) =>
      set((state) => {
        // Only push the previous value to history when both prev and next are
        // real tones — clearing (null) or initial-set shouldn't generate an
        // undo step.
        const history =
          state.leftTone && tone
            ? [...state.leftToneHistory, state.leftTone].slice(-MAX_TONE_HISTORY)
            : state.leftToneHistory;
        return {leftTone: tone, leftToneHistory: history};
      }),
    setDualTone2: (tone) =>
      set((state) => {
        const history =
          state.dualTone2 && tone
            ? [...state.dualTone2History, state.dualTone2].slice(-MAX_TONE_HISTORY)
            : state.dualTone2History;
        return {dualTone2: tone, dualTone2History: history};
      }),
    setSplitLeftShift: (value) => set({splitLeftShift: value}),
    setSplitRightShift: (value) => set({splitRightShift: value}),
    setDualT1Shift: (value) => set({dualT1Shift: value}),
    setDualT2Shift: (value) => set({dualT2Shift: value}),
    setTwinMode: (value) => set({twinMode: value}),
    resetPerformance: () => set(initialState),
  }));
}

function _get(): StoreType {
  if (!_store) throw new Error('performanceStore not initialized: call createPerformanceStore first');
  return _store;
}

const _proxy = ((...args: Parameters<StoreType>) => _get()(...args)) as StoreType;
_proxy.getState = () => _get().getState();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
_proxy.setState = (state: any, replace?: any) => _get().setState(state, replace);
_proxy.subscribe = (...args: Parameters<StoreType['subscribe']>) => _get().subscribe(...args);
_proxy.getInitialState = () => _get().getInitialState();

export const usePerformanceStore = _proxy;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createPerformanceStore(_opts?: {storage?: unknown}) {
  _store = _build();
  return usePerformanceStore;
}
