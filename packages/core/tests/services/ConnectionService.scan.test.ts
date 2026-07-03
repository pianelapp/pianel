/**
 * Tests for ConnectionService.scan accumulation and refreshDiscoveredDevices.
 *
 * Covers:
 *   - scan accumulates every yielded device into discoveredDevices (no longer
 *     stops on first hit).
 *   - status settles to 'discovered' when scan yields results, 'idle' otherwise.
 *   - refreshDiscoveredDevices prefers transport.listDevices() when available,
 *     falls back to scan() otherwise.
 */

import {ConnectionService} from '../../src/services/ConnectionService';
import {createConnectionStore, useConnectionStore} from '../../src/store/connectionStore';
import {createProfilesStore} from '../../src/store/profilesStore';
import {inMemoryStorage} from '../../src/store/storage';
import type {
  Transport,
  DiscoveredDevice,
  NotificationListener,
} from '../../src/transport/types';

beforeAll(() => {
  createConnectionStore({storage: inMemoryStorage});
  createProfilesStore({storage: inMemoryStorage});
});

// Track every service created in a test so we can tear it down afterwards. A
// completed connect() starts a heartbeat interval, an auto-reconnect monitor
// interval, and a state-read safety timeout; without destroy() those keep the
// Jest worker's event loop alive and trigger the "worker failed to exit
// gracefully" warning.
const services: ConnectionService[] = [];
function createService(transport: Transport): ConnectionService {
  const service = new ConnectionService(transport);
  services.push(service);
  return service;
}

beforeEach(() => {
  useConnectionStore.getState().reset();
});

afterEach(async () => {
  await Promise.all(services.splice(0).map(service => service.destroy()));
});

function makeFakeBleTransport(devicesToYield: DiscoveredDevice[]): Transport {
  let status: 'idle' | 'connected' | 'disconnected' = 'idle';
  return {
    get status() {
      return status;
    },
    scan: jest.fn(async (onDiscovered: (d: DiscoveredDevice) => void) => {
      for (const d of devicesToYield) onDiscovered(d);
    }),
    stopScan: jest.fn(async () => {}),
    connect: jest.fn(async () => {
      status = 'connected';
    }),
    disconnect: jest.fn(async () => {
      status = 'disconnected';
    }),
    send: jest.fn(async () => {}),
    subscribe: (_l: NotificationListener) => () => {},
    destroy: jest.fn(async () => {}),
  };
}

function makeFakeWebMIDITransport(devices: DiscoveredDevice[]): Transport {
  let status: 'idle' | 'connected' | 'disconnected' = 'idle';
  return {
    get status() {
      return status;
    },
    scan: jest.fn(async () => {}),
    stopScan: jest.fn(async () => {}),
    listDevices: jest.fn(async () => devices),
    connect: jest.fn(async () => {
      status = 'connected';
    }),
    disconnect: jest.fn(async () => {
      status = 'disconnected';
    }),
    send: jest.fn(async () => {}),
    subscribe: (_l: NotificationListener) => () => {},
    destroy: jest.fn(async () => {}),
  };
}

describe('ConnectionService.scan accumulation', () => {
  it('accumulates every yielded device into discoveredDevices', async () => {
    const transport = makeFakeBleTransport([
      {id: 'A', name: 'FP-30X #1'},
      {id: 'B', name: 'FP-30X #2'},
    ]);
    const service = createService(transport);
    await service.scan(10);
    expect(useConnectionStore.getState().discoveredDevices).toEqual([
      {id: 'A', name: 'FP-30X #1'},
      {id: 'B', name: 'FP-30X #2'},
    ]);
  });

  it('does not call stopScan after the first device', async () => {
    const transport = makeFakeBleTransport([
      {id: 'A', name: 'FP-30X'},
      {id: 'B', name: 'FP-30X'},
    ]);
    const service = createService(transport);
    await service.scan(10);
    expect(transport.stopScan).not.toHaveBeenCalled();
  });

  it('finalizes status to discovered when scan yielded results', async () => {
    const transport = makeFakeBleTransport([{id: 'A', name: 'FP-30X'}]);
    const service = createService(transport);
    await service.scan(10);
    expect(useConnectionStore.getState().status).toBe('discovered');
  });

  it('finalizes status to idle when scan yielded nothing', async () => {
    const transport = makeFakeBleTransport([]);
    const service = createService(transport);
    await service.scan(10);
    expect(useConnectionStore.getState().status).toBe('idle');
  });

  it('falls back to idle if transport.scan throws', async () => {
    const transport = makeFakeBleTransport([]);
    (transport.scan as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('scan failure');
    });
    const service = createService(transport);
    await expect(service.scan(10)).rejects.toThrow('scan failure');
    expect(useConnectionStore.getState().status).toBe('idle');
  });
});

describe('ConnectionService.connect identity propagation', () => {
  it('copies name from discoveredDevices into deviceId/deviceName when connecting by id', async () => {
    const transport = makeFakeBleTransport([]);
    // Pre-populate the discovery list (as if a scan had run).
    useConnectionStore.getState().addDiscoveredDevice({id: 'XYZ', name: 'My FP-30X'});
    const service = createService(transport);

    // The identify path will time out and fall back to default engine, but the
    // store snapshot for name/id should be set before transport.connect runs.
    await service.connect('XYZ').catch(() => undefined);

    const state = useConnectionStore.getState();
    expect(state.deviceId).toBe('XYZ');
    expect(state.deviceName).toBe('My FP-30X');
  });

  it('does nothing to identity when deviceId is empty (legacy chooser path)', async () => {
    const transport = makeFakeBleTransport([]);
    useConnectionStore.getState().addDiscoveredDevice({id: 'XYZ', name: 'My FP-30X'});
    const service = createService(transport);

    await service.connect('').catch(() => undefined);

    const state = useConnectionStore.getState();
    // Identity should not be auto-pulled from the discovered list when no id was supplied.
    expect(state.deviceId).toBeNull();
    expect(state.deviceName).toBeNull();
  });

  it('does nothing when the supplied id is not in discoveredDevices', async () => {
    const transport = makeFakeBleTransport([]);
    const service = createService(transport);

    await service.connect('UNKNOWN').catch(() => undefined);

    const state = useConnectionStore.getState();
    expect(state.deviceId).toBeNull();
    expect(state.deviceName).toBeNull();
  });
});

describe('ConnectionService.refreshDiscoveredDevices', () => {
  it('uses listDevices when transport exposes it', async () => {
    const transport = makeFakeWebMIDITransport([
      {id: 'X', name: 'Roland Output'},
      {id: 'Y', name: 'Other MIDI'},
    ]);
    const service = createService(transport);
    await service.refreshDiscoveredDevices();
    expect(transport.listDevices).toHaveBeenCalled();
    expect(useConnectionStore.getState().discoveredDevices).toEqual([
      {id: 'X', name: 'Roland Output'},
      {id: 'Y', name: 'Other MIDI'},
    ]);
    // listDevices path must NOT flip into 'scanning'.
    expect(useConnectionStore.getState().status).not.toBe('scanning');
  });

  it('clears stale entries before populating fresh ones', async () => {
    const transport = makeFakeWebMIDITransport([{id: 'NEW', name: 'fresh'}]);
    useConnectionStore.getState().addDiscoveredDevice({id: 'STALE', name: 'old'});
    const service = createService(transport);
    await service.refreshDiscoveredDevices();
    expect(useConnectionStore.getState().discoveredDevices).toEqual([
      {id: 'NEW', name: 'fresh'},
    ]);
  });

  it('falls back to scan when listDevices is undefined', async () => {
    const transport = makeFakeBleTransport([{id: 'Y', name: 'BLE Piano'}]);
    const service = createService(transport);
    await service.refreshDiscoveredDevices(10);
    expect(transport.scan).toHaveBeenCalled();
    expect(useConnectionStore.getState().discoveredDevices).toEqual([
      {id: 'Y', name: 'BLE Piano'},
    ]);
  });
});
