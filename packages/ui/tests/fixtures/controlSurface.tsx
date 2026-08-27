import {act} from 'react';
import {render, type RenderResult} from '../utils/render';
import {PerformActions} from '../../src/components/control/PerformActions';
import {PianoActions} from '../../src/components/control/PianoActions';
import {setControlSurfaceService, resetControlSurfaceService} from '../../src/hooks/useControlSurface';
import {setPianoService} from '../../src/hooks/usePiano';
import {ControlSurfaceService} from '@pianel/core/services/control/ControlSurfaceService';
import {
  getControlActionRegistry,
  resetControlActionRegistry,
} from '@pianel/core/services/control/registry';
import {useControlBindingsStore, useControlSurfaceStore} from '../../src/store';
import type {PianoService} from '@pianel/core/services/PianoService';
import type {
  DiscoveredDevice,
  InputTransport,
  NotificationListener,
  TransportStatus,
  TransportStatusListener,
  Unsubscribe,
} from '@pianel/core/transport/types';
import type {Behaviour} from '../../src/store';

export class StubInputTransport implements InputTransport {
  status: TransportStatus = 'idle';
  deviceName: string | null = null;
  devices: DiscoveredDevice[] = [{id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'}];
  private listeners: NotificationListener[] = [];
  private statusListeners: TransportStatusListener[] = [];

  async listDevices(): Promise<DiscoveredDevice[]> {
    return this.devices;
  }

  async connect(deviceId: string, deviceName?: string | null): Promise<void> {
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

export interface ControlHarness {
  transport: StubInputTransport;
  service: ControlSurfaceService;
  rendered: RenderResult;
  rerender: () => void;
  tick: (ms: number) => void;
  press: (id?: number) => Promise<void>;
  release: (id?: number) => Promise<void>;
  bind: (actionId: string, behaviour: Behaviour, id?: number) => void;
  teardown: () => Promise<void>;
}

export function mountControlSurface(): ControlHarness {
  resetControlActionRegistry();
  resetControlSurfaceService();
  useControlBindingsStore.getState().clearAll();
  useControlSurfaceStore.getState().endLearn();
  useControlSurfaceStore.getState().setHeld(null);
  useControlSurfaceStore.getState().setAttached(false, null);

  let clock = 0;
  const transport = new StubInputTransport();
  const service = new ControlSurfaceService(transport, getControlActionRegistry(), {
    now: () => clock,
  });
  setControlSurfaceService(service);

  const tree = (
    <>
      <PerformActions />
      <PianoActions />
    </>
  );
  const rendered = render(tree);

  const emit = async (bytes: number[]): Promise<void> => {
    await act(async () => {
      transport.emit(bytes);
      await service.whenIdle();
    });
  };

  return {
    transport,
    service,
    rendered,
    rerender: () => rendered.rerender(tree),
    tick: ms => {
      clock += ms;
    },
    press: (id = 20) => emit([0xb0, id, 0x7f]),
    release: (id = 20) => emit([0xb0, id, 0x00]),
    bind: (actionId, behaviour, id = 20) => {
      useControlBindingsStore.getState().addBinding({
        match: {type: 'cc', channel: 1, id},
        actionId,
        behaviour,
      });
    },
    teardown: async () => {
      rendered.unmount();
      await service.destroy();
      resetControlSurfaceService();
      resetControlActionRegistry();
    },
  };
}

export function stubPianoWithMetronome(): {toggleMetronome: jest.Mock} {
  const toggleMetronome = jest.fn().mockResolvedValue(undefined);
  setPianoService({toggleMetronome} as unknown as PianoService);
  return {toggleMetronome};
}
