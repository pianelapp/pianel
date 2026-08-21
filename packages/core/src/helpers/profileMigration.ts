import {CURRENT_SCHEMA_VERSION} from '../types/schemaVersion';
import type {Setlist, Song} from '../types/setlist';
import type {Profile} from '../types/profile';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeProfile(input: unknown): Profile {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    ...(raw as unknown as Profile),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    songs: asArray<Song>(raw.songs),
    setlists: asArray<Setlist>(raw.setlists),
  };
}
