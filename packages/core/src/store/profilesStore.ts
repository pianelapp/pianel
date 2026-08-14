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
  addProfile: (profile: Profile) => void;
  updateProfileInList: (profile: Profile) => void;
  renameProfileInList: (profileId: string, newName: string) => void;
  removeProfile: (profileId: string) => void;
  setActiveProfileId: (profileId: string) => void;
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

export function selectActiveProfile(
  state: ProfilesState,
): Profile | null {
  return (
    state.profiles.find(p => p.id === state.activeProfileId) ?? null
  );
}

export function selectActivePresets(state: ProfilesState) {
  return selectActiveProfile(state)?.presets ?? [];
}
