import type {
  InputTransport,
  NotificationListener,
  TransportStatus,
  TransportStatusListener,
  Unsubscribe,
  DiscoveredDevice,
} from '../../src/transport/types';

class StubInputTransport implements InputTransport {
  status: TransportStatus = 'idle';
  deviceName: string | null = null;
  private listeners: NotificationListener[] = [];
  private statusListeners: TransportStatusListener[] = [];

  async listDevices(): Promise<DiscoveredDevice[]> {
    return [{id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'}];
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
    for (const l of [...this.listeners]) l(bytes);
  }

  private setStatus(status: TransportStatus): void {
    this.status = status;
    for (const l of [...this.statusListeners]) l(status);
  }
}

describe('InputTransport contract', () => {
  let transport: StubInputTransport;

  beforeEach(() => {
    transport = new StubInputTransport();
  });

  it('enumerates input devices', async () => {
    await expect(transport.listDevices()).resolves.toEqual([
      {id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'},
    ]);
  });

  it('subscribe returns an unsubscribe function that stops delivery', () => {
    const received: number[][] = [];
    const unsub = transport.subscribe(bytes => received.push(bytes));

    transport.emit([0xb0, 0x14, 0x7f]);
    unsub();
    transport.emit([0xb0, 0x14, 0x00]);

    expect(received).toEqual([[0xb0, 0x14, 0x7f]]);
  });

  it('delivers every notification to every listener', () => {
    const a: number[][] = [];
    const b: number[][] = [];
    transport.subscribe(bytes => a.push(bytes));
    transport.subscribe(bytes => b.push(bytes));

    transport.emit([0xb0, 0x14, 0x7f]);

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('reports status transitions to onStatusChange subscribers', async () => {
    const seen: TransportStatus[] = [];
    transport.onStatusChange(status => seen.push(status));

    await transport.connect('in-pedal', 'FootCtrlPlus Bluetooth');
    await transport.disconnect();

    expect(seen).toEqual(['connected', 'disconnected']);
  });

  it('stops reporting status after unsubscribe', async () => {
    const seen: TransportStatus[] = [];
    const unsub = transport.onStatusChange(status => seen.push(status));

    await transport.connect('in-pedal');
    unsub();
    await transport.disconnect();

    expect(seen).toEqual(['connected']);
  });

  it('remembers the device name it was connected with', async () => {
    await transport.connect('in-pedal', 'FootCtrlPlus Bluetooth');
    expect(transport.deviceName).toBe('FootCtrlPlus Bluetooth');
  });

  it('drops all listeners on destroy', async () => {
    const received: number[][] = [];
    transport.subscribe(bytes => received.push(bytes));

    await transport.destroy();
    transport.emit([0xb0]);

    expect(received).toEqual([]);
  });
});
