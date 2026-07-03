/**
 * usePresets hook — per-tile preset operations scoped to the active profile.
 *
 * The hook reads the active profile's `presets[]` from `useProfilesStore`
 * and delegates state-mutating actions to `ProfileService` (which is
 * constructed in `App.tsx`/`main.tsx` and injected via `setProfileService`).
 */

import { useCallback, useMemo } from 'react';
import { useProfilesStore, selectActiveProfile } from '../store';
import type { Preset } from '../store';
import { getProfileService } from './useProfiles';

export function usePresets() {
  const activeProfile = useProfilesStore(selectActiveProfile);
  const presets: Preset[] = useMemo(
    () => activeProfile?.presets ?? [],
    [activeProfile],
  );

  const savePresetToTile = useCallback(
    async (tilePosition: number, label: string): Promise<Preset | null> => {
      const service = getProfileService();
      if (!service) return null;
      return service.savePresetToTile(tilePosition, label);
    },
    [],
  );

  const applyPreset = useCallback(
    async (presetId: string): Promise<void> => {
      const service = getProfileService();
      if (!service) return;
      await service.applyPreset(presetId);
    },
    [],
  );

  const updatePreset = useCallback(
    async (presetId: string, opts?: { label?: string }): Promise<void> => {
      const service = getProfileService();
      if (!service) return;
      await service.updatePreset(presetId, opts);
    },
    [],
  );

  const renamePreset = useCallback(
    async (presetId: string, newLabel: string): Promise<void> => {
      const service = getProfileService();
      if (!service) return;
      await service.renamePreset(presetId, newLabel);
    },
    [],
  );

  const deletePreset = useCallback(
    async (presetId: string): Promise<void> => {
      const service = getProfileService();
      if (!service) return;
      await service.deletePreset(presetId);
    },
    [],
  );

  return {
    presets,
    savePresetToTile,
    applyPreset,
    updatePreset,
    renamePreset,
    deletePreset,
  };
}
