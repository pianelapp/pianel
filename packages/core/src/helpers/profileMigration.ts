/**
 * Forward/backward-compatible profile normalizer (design D7).
 *
 * Applied to any profile record arriving from persisted storage or an import
 * file. v1 records predate `songs`/`setlists`; this fills them and bumps
 * `schemaVersion`. Defensive against non-array values so a corrupted record
 * degrades to empty rather than crashing the boot path.
 */

import {CURRENT_SCHEMA_VERSION} from '../types/setlist';
import type {Setlist, Song} from '../types/setlist';
import type {Profile} from '../types/profile';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeProfile(input: unknown): Profile {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    ...(raw as unknown as Profile),
    schemaVersion: CURRENT_SCHEMA_VERSION as 2,
    songs: asArray<Song>(raw.songs),
    setlists: asArray<Setlist>(raw.setlists),
  };
}
