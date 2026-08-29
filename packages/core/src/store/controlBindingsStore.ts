import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import type {StateStorage} from './storage';
import {generateProfileId} from '../helpers/profileId';
import {behavioursFor, matchesMessage, sameMatch} from '../helpers/controlMessage';
import type {
  Behaviour,
  ControlBinding,
  ControlDevice,
  ControlMatch,
  ControlMessage,
} from '../types/control';

export const CONTROL_BINDINGS_VERSION = 1;

export interface ControlBindingsState {
  version: number;
  bindings: ControlBinding[];
  device: ControlDevice | null;
}

export interface ControlBindingsActions {
  addBinding: (draft: {
    match: ControlMatch;
    actionId: string;
    behaviour: Behaviour;
  }) => ControlBinding;
  removeBinding: (bindingId: string) => void;
  bindingsFor: (actionId: string) => ControlBinding[];
  findByMessage: (message: ControlMessage) => ControlBinding | null;
  setDevice: (device: ControlDevice | null) => void;
  clearAll: () => void;
}

type StoreType = ReturnType<typeof _build>;
let _store: StoreType | null = null;

function _build(storage: StateStorage) {
  return create<ControlBindingsState & ControlBindingsActions>()(
    persist(
      (set, get) => ({
        version: CONTROL_BINDINGS_VERSION,
        bindings: [],
        device: null,

        addBinding: ({match, actionId, behaviour}) => {
          if (!behavioursFor(match).includes(behaviour)) {
            throw new Error(
              `A ${match.type} control cannot be bound to "${behaviour}" because it reports no release.`,
            );
          }
          const created: ControlBinding = {
            id: generateProfileId(),
            match,
            actionId,
            behaviour,
          };
          set(state => ({
            bindings: [
              ...state.bindings.filter(b => !sameMatch(b.match, match)),
              created,
            ],
          }));
          return created;
        },

        removeBinding: bindingId =>
          set(state => ({
            bindings: state.bindings.filter(b => b.id !== bindingId),
          })),

        bindingsFor: actionId =>
          get().bindings.filter(b => b.actionId === actionId),

        findByMessage: message =>
          get().bindings.find(b => matchesMessage(b.match, message)) ?? null,

        setDevice: device => set({device}),

        clearAll: () =>
          set({
            version: CONTROL_BINDINGS_VERSION,
            bindings: [],
            device: null,
          }),
      }),
      {
        name: 'pianel:control-bindings',
        storage: createJSONStorage(() => storage),
      },
    ),
  );
}

function _get(): StoreType {
  if (!_store) throw new Error('controlBindingsStore not initialized');
  return _store;
}

const _proxy = ((...args: Parameters<StoreType>) => _get()(...args)) as StoreType;
_proxy.getState = () => _get().getState();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
_proxy.setState = (state: any, replace?: any) => _get().setState(state, replace);
_proxy.subscribe = (...args: Parameters<StoreType['subscribe']>) => _get().subscribe(...args);
_proxy.getInitialState = () => _get().getInitialState();

export const useControlBindingsStore = _proxy;

export function createControlBindingsStore({storage}: {storage: StateStorage}) {
  _store = _build(storage);
  return useControlBindingsStore;
}
