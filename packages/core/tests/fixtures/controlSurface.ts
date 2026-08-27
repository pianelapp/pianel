import {ControlActionRegistry} from '../../src/services/control/registry';
import {
  ControlSurfaceService,
  type ControlSurfaceServiceOptions,
} from '../../src/services/control/ControlSurfaceService';
import {
  createControlBindingsStore,
  useControlBindingsStore,
} from '../../src/store/controlBindingsStore';
import {useControlSurfaceStore} from '../../src/store/controlSurfaceStore';
import {inMemoryStorage} from '../../src/store/storage';
import type {
  DiscoveredDevice,
  InputTransport,
  NotificationListener,
  TransportStatus,
  TransportStatusListener,
  Unsubscribe,
} from '../../src/transport/types';
import type {
  Behaviour,
  ControlAction,
  ControlBinding,
} from '../../src/types/control';

let storeReady = false;

export function ensureControlStores(): void {
  if (storeReady) return;
  createControlBindingsStore({storage: inMemoryStorage});
  storeReady = true;
}

export function resetControlWorld(): void {
  ensureControlStores();
  useControlBindingsStore.getState().clearAll();
  useControlSurfaceStore.getState().endLearn();
  useControlSurfaceStore.getState().setHeld(null);
  useControlSurfaceStore.getState().setAttached(false, null);
  useControlSurfaceStore.setState({lastMessage: null, lastMessageAt: null});
}

export class StubInputTransport implements InputTransport {
  status: TransportStatus = 'idle';
  deviceName: string | null = null;
  devices: DiscoveredDevice[] = [
    {id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'},
  ];
  readonly connectCalls: Array<{deviceId: string; deviceName: string | null}> = [];
  private listeners: NotificationListener[] = [];
  private statusListeners: TransportStatusListener[] = [];

  async listDevices(): Promise<DiscoveredDevice[]> {
    return this.devices;
  }

  async connect(deviceId: string, deviceName?: string | null): Promise<void> {
    this.connectCalls.push({deviceId, deviceName: deviceName ?? null});
    this.deviceName = deviceName ?? deviceId;
    this.setStatus('connected');
  }

  async disconnect(): Promise<void> {
    this.deviceName = null;
    this.setStatus('disconnected');
  }

  subscribe(listener: NotificationListener): Unsubscribe {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  onStatusChange(listener: TransportStatusListener): Unsubscribe {
    this.statusListeners.push(listener);
    return () => {
      const idx = this.statusListeners.indexOf(listener);
      if (idx !== -1) this.statusListeners.splice(idx, 1);
    };
  }

  async destroy(): Promise<void> {
    this.listeners = [];
    this.statusListeners = [];
  }

  emit(bytes: number[]): void {
    for (const listener of [...this.listeners]) listener(bytes);
  }

  setStatus(status: TransportStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of [...this.statusListeners]) listener(status);
  }
}

export function makeAction(
  id: string,
  over: Partial<ControlAction> = {},
): ControlAction & {run: jest.Mock; beginPeek: jest.Mock} {
  const run = jest.fn().mockResolvedValue(undefined);
  const beginPeek = jest.fn().mockResolvedValue({end: jest.fn().mockResolvedValue(undefined)});
  return {
    id,
    label: id,
    group: 'Perform',
    behaviours: ['press', 'release', 'peek'],
    run,
    beginPeek,
    ...over,
  } as ControlAction & {run: jest.Mock; beginPeek: jest.Mock};
}

export function controlWorld(options: ControlSurfaceServiceOptions = {}) {
  resetControlWorld();

  let clock = 0;
  const transport = new StubInputTransport();
  const registry = new ControlActionRegistry();
  const service = new ControlSurfaceService(transport, registry, {
    now: () => clock,
    ...options,
  });

  const tick = (ms: number): void => {
    clock += ms;
  };

  const press = async (id = 20): Promise<void> => {
    transport.emit([0xb0, id, 0x7f]);
    await service.whenIdle();
  };

  const release = async (id = 20): Promise<void> => {
    transport.emit([0xb0, id, 0x00]);
    await service.whenIdle();
  };

  const bind = (
    actionId: string,
    behaviour: Behaviour,
    id = 20,
  ): ControlBinding =>
    useControlBindingsStore.getState().addBinding({
      match: {type: 'cc', channel: 1, id},
      actionId,
      behaviour,
    });

  return {transport, registry, service, tick, press, release, bind};
}
