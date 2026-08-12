/**
 * Shared active-profile access for the song/setlist services. Both need the
 * same read-modify-write against the active profile; keeping it in one place
 * stops the pair from drifting.
 */

import {selectActiveProfile, useProfilesStore} from '../store/profilesStore';
import {ProfileNotFoundError} from '../types/profile';
import type {Profile} from '../types/profile';

/** The active profile, or throw when `activeProfileId` resolves to nothing. */
export function requireActiveProfile(): Profile {
  const active = selectActiveProfile(useProfilesStore.getState());
  if (!active) {
    throw new ProfileNotFoundError(useProfilesStore.getState().activeProfileId);
  }
  return active;
}

/** Apply a patch to the active profile and write it back, stamping updatedAt. */
export function writeActiveProfile(patch: (profile: Profile) => Profile): void {
  const active = requireActiveProfile();
  const next: Profile = {
    ...patch(active),
    updatedAt: new Date().toISOString(),
  };
  useProfilesStore.getState().updateProfileInList(next);
}
