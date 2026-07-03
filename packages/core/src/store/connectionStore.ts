import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import type {StateStorage} from './storage';
import type {DiscoveredDevice} from '../transport/types';

export type {DiscoveredDevice};

export type ConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'discovered'
  | 'connecting'
  | 'connected'
  | 'stale'
  | 'disconnected';

export interface ConnectionState {
  deviceId: string | null;
  deviceName: string | null;
  status: ConnectionStatus;
  lastConnectedAt: string | null;
  isFirstConnectionThisSession: boolean;
  /** Epoch ms of the last inbound notification or heartbeat reply. Runtime-only — not persisted. */
  lastSeenAt: number | null;
  /** Devices yielded by the most recent scan. Runtime-only — NOT persisted. */
  discoveredDevices: DiscoveredDevice[];
}

export interface ConnectionActions {
  setScanning: () => void;
  setDiscovered: (deviceId: string, deviceName: string) => void;
  setConnecting: () => void;
  setConnected: () => void;
  setDisconnected: () => void;
  setIdle: () => void;
  reset: () => void;
  markFirstConnectionHandled: () => void;
  markSeen: () => void;
  setStale: () => void;
  addDiscoveredDevice: (device: DiscoveredDevice) => void;
  clearDiscoveredDevices: () => void;
}

const initialState: ConnectionState = {
  deviceId: null,
  deviceName: null,
  status: 'idle',
  lastConnectedAt: null,
  isFirstConnectionThisSession: true,
  lastSeenAt: null,
  discoveredDevices: [],
};

type StoreType = ReturnType<typeof _build>;
let _store: StoreType | null = null;

function _build(storage: StateStorage) {
  return create<ConnectionState & ConnectionActions>()(
    persist(
      (set) => ({
        ...initialState,
        setScanning: () => set({status: 'scanning', discoveredDevices: []}),
        setDiscovered: (deviceId, deviceName) =>
          set({deviceId, deviceName, status: 'discovered'}),
        setConnecting: () => set({status: 'connecting'}),
        setConnected: () =>
          set({
            status: 'connected',
            lastConnectedAt: new Date().toISOString(),
            lastSeenAt: Date.now(),
          }),
        setDisconnected: () => set({status: 'disconnected'}),
        setIdle: () => set({status: 'idle'}),
        reset: () => set(initialState),
        markFirstConnectionHandled: () =>
          set({isFirstConnectionThisSession: false}),
        markSeen: () => set({lastSeenAt: Date.now()}),
        setStale: () => {
          // Only meaningful while currently connected — protects against
          // spurious flips during 'connecting' or after 'disconnected'.
          set((s) => (s.status === 'connected' ? {status: 'stale'} : {}));
        },
        addDiscoveredDevice: (device) =>
          set((s) => {
            const idx = s.discoveredDevices.findIndex((d) => d.id === device.id);
            if (idx === -1) {
              return {discoveredDevices: [...s.discoveredDevices, device]};
            }
            if (s.discoveredDevices[idx].name === device.name) return {};
            const next = s.discoveredDevices.slice();
            next[idx] = device;
            return {discoveredDevices: next};
          }),
        clearDiscoveredDevices: () => set({discoveredDevices: []}),
      }),
      {
        name: 'pianel:connection',
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({
          deviceId: state.deviceId,
          deviceName: state.deviceName,
          lastConnectedAt: state.lastConnectedAt,
        }),
      },
    ),
  );
}

function _get(): StoreType {
  if (!_store) throw new Error('connectionStore not initialized: call createConnectionStore first');
  return _store;
}

const _proxy = ((...args: Parameters<StoreType>) => _get()(...args)) as StoreType;
_proxy.getState = () => _get().getState();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
_proxy.setState = (state: any, replace?: any) => _get().setState(state, replace);
_proxy.subscribe = (...args: Parameters<StoreType['subscribe']>) => _get().subscribe(...args);
_proxy.getInitialState = () => _get().getInitialState();

export const useConnectionStore = _proxy;

export function createConnectionStore({storage}: {storage: StateStorage}) {
  _store = _build(storage);
  return useConnectionStore;
}
