/**
 * useProfiles hook — profile lifecycle + load + import/export bindings.
 *
 * Wraps the singleton `ProfileService` (set via `setProfileService` from
 * `main.tsx`) and the `useProfilesStore` reactive selectors.
 */

import { useCallback, useMemo } from 'react';
import { useProfilesStore, selectActiveProfile } from '../store';
import type { Profile, ProfileExportFile } from '../store';
import type { ProfileService, ImportResult } from '@pianel/core/services/profiles/ProfileService';

let profileServiceInstance: ProfileService | null = null;

export function setProfileService(service: ProfileService): void {
  profileServiceInstance = service;
}

export function getProfileService(): ProfileService | null {
  return profileServiceInstance;
}

export function resetProfileService(): void {
  profileServiceInstance = null;
}

export function useProfiles() {
  const allProfiles = useProfilesStore(s => s.profiles);
  const activeProfile = useProfilesStore(selectActiveProfile);

  const profiles = useMemo(
    () =>
      [...allProfiles].sort((a, b) =>
        a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
      ),
    [allProfiles],
  );

  const createProfile = useCallback(
    async (name: string): Promise<Profile | null> => {
      const service = getProfileService();
      if (!service) return null;
      return service.createProfile(name);
    },
    [],
  );

  const updateProfile = useCallback(
    async (id: string, opts?: { name?: string }): Promise<Profile | null> => {
      const service = getProfileService();
      if (!service) return null;
      return service.updateProfile(id, opts);
    },
    [],
  );

  const renameProfile = useCallback(
    async (id: string, newName: string): Promise<Profile | null> => {
      const service = getProfileService();
      if (!service) return null;
      return service.renameProfile(id, newName);
    },
    [],
  );

  const deleteProfile = useCallback(async (id: string): Promise<string | null> => {
    const service = getProfileService();
    if (!service) return null;
    const { newActiveProfileId } = await service.deleteProfile(id);
    return newActiveProfileId;
  }, []);

  const loadProfile = useCallback(async (id: string): Promise<void> => {
    const service = getProfileService();
    if (!service) return;
    await service.loadProfile(id);
  }, []);

  const exportProfile = useCallback(async (id: string): Promise<boolean> => {
    const service = getProfileService();
    if (!service) return false;
    const { saved } = await service.exportProfile(id);
    return saved;
  }, []);

  const importProfile = useCallback(async (): Promise<ImportResult | null> => {
    const service = getProfileService();
    if (!service) return null;
    return service.importProfile();
  }, []);

  const confirmImportOverwrite = useCallback(
    async (parsed: ProfileExportFile): Promise<Profile | null> => {
      const service = getProfileService();
      if (!service) return null;
      return service.confirmImportOverwrite(parsed);
    },
    [],
  );

  return {
    profiles,
    activeProfile,
    createProfile,
    updateProfile,
    renameProfile,
    deleteProfile,
    loadProfile,
    exportProfile,
    importProfile,
    confirmImportOverwrite,
  };
}
