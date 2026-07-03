/**
 * App Settings Zustand Store.
 *
 * T023: Persists app-level user preferences in MMKV.
 * - Theme preference: system/light/dark (Constitution III: System-Adaptive)
 * - Last viewed tone category index (DT1 category 0-8)
 * - Default preset for auto-apply on first connect
 * - Quick-tone slot assignments (3 slots)
 */

import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import type {StateStorage} from './storage';
import type {ToneSlot} from '../types/voicingMode';
import type {QuickToneSlot} from '../types/quickToneSlot';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Sharp/flat spelling preference for chord and pitch-class display. */
export type AccidentalPreference = 'sharps' | 'flats';

/** Three quick-tone slots. Each is a full voicing-mode snapshot or null. */
export type QuickToneSlotsTuple = [
  QuickToneSlot | null,
  QuickToneSlot | null,
  QuickToneSlot | null,
];

export interface AppSettingsState {
  /** User's theme override (default: system) */
  themePreference: ThemePreference;
  /** Last viewed tone category index (DT1 category 0-8). Default: 0 (Piano) */
  lastCategoryIndex: number;
  /** Last viewed tone category index for the Left/Tone 2 slot (Dual/Split). Default: 0 (Piano) */
  lastLeftCategoryIndex: number;
  /** Default preset ID for auto-apply on first connect (null = none) */
  defaultPresetId: string | null;
  /** Quick-tone slot assignments (3 slots). Each is a full voicing-mode snapshot or null. */
  quickToneSlots: QuickToneSlotsTuple;
  /** Display preference for sharps vs flats in chord/pitch names. Default: 'sharps'.
   *  Consumed by `ChordService` via `setUseSharps(accidentalPreference === 'sharps')`. */
  accidentalPreference: AccidentalPreference;
  /** Which tone-slot the UI is currently editing (Tone 1/Upper = 'right', Tone 2/Lower = 'left').
   *  Single/Twin always force 'right'. Consumed by `useTones`/`useVoicingMode` so the
   *  Library, slot tabs, and tone steppers stay synchronized. */
  activeToneSlot: ToneSlot;
  /** Profile id loaded automatically at app boot. Seeded by
   *  `ProfileService.ensureDefaultProfile()` when the Default profile is
   *  created or repaired. `null` falls back to `activeProfileId` at boot. */
  bootProfileId: string | null;
}

export interface AppSettingsActions {
  /** Set theme preference */
  setThemePreference: (pref: ThemePreference) => void;
  /** Set last used tone category index (0-8) */
  setLastCategoryIndex: (index: number) => void;
  /** Set last used Left/Tone 2 category index (0-8) */
  setLastLeftCategoryIndex: (index: number) => void;
  /** Set the default preset ID */
  setDefaultPresetId: (presetId: string | null) => void;
  /** Set a quick-tone slot (0-2) to a full voicing-mode snapshot or null. */
  setQuickToneSlot: (slot: 0 | 1 | 2, value: QuickToneSlot | null) => void;
  /** Set the sharp/flat display preference */
  setAccidentalPreference: (pref: AccidentalPreference) => void;
  /** Set the slot the UI is currently editing. */
  setActiveToneSlot: (slot: ToneSlot) => void;
  /** Set the profile id auto-loaded at app boot. */
  setBootProfileId: (profileId: string | null) => void;
}

type StoreType = ReturnType<typeof _build>;
let _store: StoreType | null = null;

function _build(storage: StateStorage) {
  return create<AppSettingsState & AppSettingsActions>()(
    persist(
      (set) => ({
        themePreference: 'system',
        lastCategoryIndex: 0,
        lastLeftCategoryIndex: 0,
        defaultPresetId: null,
        quickToneSlots: [null, null, null] as QuickToneSlotsTuple,
        accidentalPreference: 'sharps',
        activeToneSlot: 'right',
        bootProfileId: null,

        setThemePreference: (pref) => set({themePreference: pref}),
        setLastCategoryIndex: (index) => set({lastCategoryIndex: index}),
        setLastLeftCategoryIndex: (index) => set({lastLeftCategoryIndex: index}),
        setDefaultPresetId: (presetId) => set({defaultPresetId: presetId}),
        setQuickToneSlot: (slot, value) =>
          set((state) => {
            const slots = [...state.quickToneSlots] as QuickToneSlotsTuple;
            slots[slot] = value;
            return {quickToneSlots: slots};
          }),
        setAccidentalPreference: (pref) => set({accidentalPreference: pref}),
        setActiveToneSlot: (slot) => set({activeToneSlot: slot}),
        setBootProfileId: (profileId) => set({bootProfileId: profileId}),
      }),
      {
        name: 'pianel:app-settings',
        storage: createJSONStorage(() => storage),
      },
    ),
  );
}

function _get(): StoreType {
  if (!_store) throw new Error('appSettingsStore not initialized');
  return _store;
}

const _proxy = ((...args: Parameters<StoreType>) => _get()(...args)) as StoreType;
_proxy.getState = () => _get().getState();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
_proxy.setState = (state: any, replace?: any) => _get().setState(state, replace);
_proxy.subscribe = (...args: Parameters<StoreType['subscribe']>) => _get().subscribe(...args);
_proxy.getInitialState = () => _get().getInitialState();

export const useAppSettingsStore = _proxy;

export function createAppSettingsStore({storage}: {storage: StateStorage}) {
  _store = _build(storage);
  return useAppSettingsStore;
}
