/**
 * T055: Transport interface contract tests.
 *
 * Verifies that any Transport implementation satisfies the contract:
 * subscribe returns an unsubscribe function, listeners receive notifications,
 * unsubscribed listeners no longer receive notifications.
 *
 * These tests use a minimal in-memory transport stub — not BLE.
 */

import type {Transport, NotificationListener, DiscoveredDevice} from '../src/transport/types';

// ─── Minimal Transport Stub ──────────────────────────────────

class StubTransport implements Transport {
  status: 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected' = 'idle';
  private listeners: NotificationListener[] = [];

  async scan(_onDiscovered: (device: DiscoveredDevice) => void, _timeoutMs?: number): Promise<void> {}
  async stopScan(): Promise<void> {}
  async connect(_deviceId: string): Promise<void> { this.status = 'connected'; }
  async disconnect(): Promise<void> { this.status = 'disconnected'; }
  async send(_bytes: number[]): Promise<void> {}
  async destroy(): Promise<void> { this.listeners = []; }

  subscribe(listener: NotificationListener) {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  emit(bytes: number[]): void {
    for (const l of this.listeners) l(bytes);
  }
}

// ─── Tests ───────────────────────────────────────────────────

describe('Transport contract', () => {
  let transport: StubTransport;

  beforeEach(() => {
    transport = new StubTransport();
  });

  it('subscribe returns an unsubscribe function', () => {
    const unsub = transport.subscribe(() => {});
    expect(typeof unsub).toBe('function');
  });

  it('subscribed listener receives emitted bytes', () => {
    const received: number[][] = [];
    transport.subscribe(bytes => received.push(bytes));

    transport.emit([0xf0, 0x41]);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual([0xf0, 0x41]);
  });

  it('unsubscribed listener no longer receives notifications', () => {
    const received: number[][] = [];
    const unsub = transport.subscribe(bytes => received.push(bytes));

    transport.emit([0x01]);
    unsub();
    transport.emit([0x02]);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual([0x01]);
  });

  it('multiple listeners each receive notifications', () => {
    const a: number[][] = [];
    const b: number[][] = [];
    transport.subscribe(bytes => a.push(bytes));
    transport.subscribe(bytes => b.push(bytes));

    transport.emit([0xf0]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('unsubscribing one listener does not affect others', () => {
    const a: number[][] = [];
    const b: number[][] = [];
    const unsubA = transport.subscribe(bytes => a.push(bytes));
    transport.subscribe(bytes => b.push(bytes));

    unsubA();
    transport.emit([0xf0]);

    expect(a).toHaveLength(0);
    expect(b).toHaveLength(1);
  });

  it('initial status is idle', () => {
    expect(transport.status).toBe('idle');
  });

  it('status changes to connected after connect', async () => {
    await transport.connect('device-123');
    expect(transport.status).toBe('connected');
  });

  it('status changes to disconnected after disconnect', async () => {
    await transport.connect('device-123');
    await transport.disconnect();
    expect(transport.status).toBe('disconnected');
  });
});
