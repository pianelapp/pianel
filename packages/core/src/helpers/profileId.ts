/**
 * Profile / Preset ID generator (R1).
 *
 * Format: `${Date.now()}-${random}` where random is 8+ base-36 characters
 * (~41 bits of entropy). Centralized here so profilesStore, ProfileService,
 * and presetsStore all share one producer (FR-013).
 *
 * The leading timestamp keeps IDs naturally sortable by creation time and
 * makes them easy to read in logs. The random suffix protects against
 * collisions when two IDs are minted in the same millisecond.
 */

export function generateProfileId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `${ts}-${rand}`;
}

/** Pattern that all profile/preset IDs must satisfy. */
export const PROFILE_ID_PATTERN = /^\d+-[a-z0-9]{8,}$/;
