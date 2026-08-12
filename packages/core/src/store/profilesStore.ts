/**
 * Profiles Zustand Store (data-model.md §2 / §7).
 *
 * Top-level container for the new Profiles & Presets pivot. Persists the full
 * list of profiles and the `activeProfileId` invariant (FR-017). Replaces the
 * previous globally-scoped `presetsStore`/`padConfigStore` for state ownership.
 *
 * Constitution I: Offline-First — persisted via the shared `StateStorage`
 * adapter (MMKV on mobile, electron-store on desktop).
 */

import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

import {normalizeProfile} from '../helpers/profileMigration';
import type {Profile} from '../types/profile';
import type {StateStorage} from './storage';

export interface ProfilesState {
  profiles: Profile[];
  activeProfileId: string;
}

export interface ProfilesActions {
  /** Append a profile to the list. Does not affect `activeProfileId`. */
  addProfile: (profile: Profile) => void;
  /** Replace a profile's full record in place (`updateProfile`, etc.). */
  updateProfileInList: (profile: Profile) => void;
  /** Patch a profile's `name` + `updatedAt`; leaves other fields untouched. */
  renameProfileInList: (profileId: string, newName: string) => void;
  /** Remove a profile from the list. Does not adjust `activeProfileId`. */
  removeProfile: (profileId: string) => void;
  /** Set the active profile id (FR-017). */
  setActiveProfileId: (profileId: string) => void;
  /** Overwrite-in-place for import flows that replace an existing id. */
  replaceProfileById: (profile: Profile) => void;
}

type StoreType = ReturnType<typeof _build>;
let _store: StoreType | null = null;

function _build(storage: StateStorage) {
  return create<ProfilesState & ProfilesActions>()(
    persist(
      set => ({
        profiles: [],
        activeProfileId: '',

        addProfile: profile =>
          set(state => ({profiles: [...state.profiles, profile]})),

        updateProfileInList: profile =>
          set(state => ({
            profiles: state.profiles.map(p =>
              p.id === profile.id ? profile : p,
            ),
          })),

        renameProfileInList: (profileId, newName) =>
          set(state => {
            const now = new Date().toISOString();
            return {
              profiles: state.profiles.map(p =>
                p.id === profileId ? {...p, name: newName, updatedAt: now} : p,
              ),
            };
          }),

        removeProfile: profileId =>
          set(state => ({
            profiles: state.profiles.filter(p => p.id !== profileId),
          })),

        setActiveProfileId: profileId => set({activeProfileId: profileId}),

        replaceProfileById: profile =>
          set(state => {
            const exists = state.profiles.some(p => p.id === profile.id);
            return {
              profiles: exists
                ? state.profiles.map(p => (p.id === profile.id ? profile : p))
                : [...state.profiles, profile],
            };
          }),
      }),
      {
        name: 'pianel:profiles',
        storage: createJSONStorage(() => storage),
        // Persist version is independent of `Profile.schemaVersion`; both are
        // 2 here by coincidence of timing, not by contract.
        version: 2,
        migrate: (persisted: unknown) => {
          const state = (persisted ?? {}) as Partial<ProfilesState>;
          return {
            ...state,
            profiles: (Array.isArray(state.profiles) ? state.profiles : []).map(
              normalizeProfile,
            ),
            activeProfileId: state.activeProfileId ?? '',
          } as ProfilesState;
        },
        // `migrate` above only runs when the stored payload carries an
        // explicit numeric `version` that differs from the one configured
        // here (zustand's own gate). Records written by builds that predate
        // persist versioning entirely have no `version` key at all, so they
        // never reach `migrate` — but `merge` runs unconditionally on every
        // hydration, so it is the one hook guaranteed to normalize every
        // profile regardless of how the stored payload got here. Re-running
        // `normalizeProfile` on already-migrated data is a no-op.
        merge: (persisted, current) => {
          const state = (persisted ?? {}) as Partial<ProfilesState>;
          return {
            ...current,
            ...state,
            profiles: (Array.isArray(state.profiles)
              ? state.profiles
              : current.profiles
            ).map(normalizeProfile),
            activeProfileId: state.activeProfileId ?? current.activeProfileId,
          };
        },
      },
    ),
  );
}

function _get(): StoreType {
  if (!_store) throw new Error('profilesStore not initialized');
  return _store;
}

const _proxy = ((...args: Parameters<StoreType>) => _get()(...args)) as StoreType;
_proxy.getState = () => _get().getState();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
_proxy.setState = (state: any, replace?: any) =>
  _get().setState(state, replace);
_proxy.subscribe = (...args: Parameters<StoreType['subscribe']>) =>
  _get().subscribe(...args);
_proxy.getInitialState = () => _get().getInitialState();
// Forward the persist middleware's API (added by `persist()` in `_build`) so
// callers can drive rehydration explicitly, e.g. in tests. Each method looks
// up the live store via `_get()` rather than capturing a stale reference, in
// case `createProfilesStore` is called again with a new storage adapter.
_proxy.persist = {
  setOptions: options => _get().persist.setOptions(options),
  clearStorage: () => _get().persist.clearStorage(),
  rehydrate: () => _get().persist.rehydrate(),
  hasHydrated: () => _get().persist.hasHydrated(),
  onHydrate: listener => _get().persist.onHydrate(listener),
  onFinishHydration: listener => _get().persist.onFinishHydration(listener),
  getOptions: () => _get().persist.getOptions(),
};

export const useProfilesStore = _proxy;

export function createProfilesStore({storage}: {storage: StateStorage}) {
  _store = _build(storage);
  return useProfilesStore;
}

// ─── Selectors ────────────────────────────────────────────────

/** Active profile (or `null` if `activeProfileId` does not match a profile). */
export function selectActiveProfile(
  state: ProfilesState,
): Profile | null {
  return (
    state.profiles.find(p => p.id === state.activeProfileId) ?? null
  );
}

/** Active profile's preset list (empty array when no active profile). */
export function selectActivePresets(state: ProfilesState) {
  return selectActiveProfile(state)?.presets ?? [];
}
