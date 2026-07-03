/**
 * Presets selectors (007-profiles-preset-pivot rewrite).
 *
 * The old globally-scoped Presets store has been removed — presets now live
 * inside the active profile (`Profile.presets[]`). This file is preserved as
 * a thin selector facade so that consumers (hooks, services) can keep
 * importing `usePresetsStore` and selecting `presets` without touching
 * `useProfilesStore` directly.
 *
 * NOTE: The previous `DT1ToneRef` / global-`Preset` shape is gone. The new
 * `Preset` type lives in `../types/profile.ts` and embeds a full
 * `PerformanceSnapshot`.
 */

import type {Preset} from '../types/profile';
import {selectActivePresets, useProfilesStore} from './profilesStore';

/** Active profile's preset list (empty array when no active profile). */
export function getActivePresets(): Preset[] {
  return selectActivePresets(useProfilesStore.getState());
}

/**
 * Hook-style accessor: returns the active profile's preset list. Components
 * that previously did `usePresetsStore(s => s.presets)` should switch to
 * `useProfilesStore(selectActivePresets)`; this thin wrapper exists for
 * test/utility code that previously called `usePresetsStore.getState().presets`.
 */
export const usePresetsStore = {
  getState(): {presets: Preset[]} {
    return {presets: getActivePresets()};
  },
};
