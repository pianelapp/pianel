import {ConnectionService} from '../../src/services/ConnectionService';
import {createConnectionStore, useConnectionStore} from '../../src/store/connectionStore';
import {createProfilesStore} from '../../src/store/profilesStore';
import {inMemoryStorage} from '../../src/store/storage';
import type {Transport, NotificationListener, Unsubscribe} from '../../src/transport/types';

class StubTransport implements Transport {
  status: Transport['status'] = 'idle';
  deviceName: string | null = 'FP-30X';
  inputPortId: string | null = null;
  private listeners: NotificationListener[] = [];

  constructor(private readonly attachedInputId: string | null) {}

  async scan(): Promise<void> {}
  async stopScan(): Promise<void> {}
  async connect(): Promise<void> {
    this.status = 'connected';
    this.inputPortId = this.attachedInputId;
  }
  async disconnect(): Promise<void> {
    this.status = 'disconnected';
    this.inputPortId = null;
  }
  async send(): Promise<void> {}
  async destroy(): Promise<void> {}

  subscribe(listener: NotificationListener): Unsubscribe {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }
}

beforeAll(() => {
  createConnectionStore({storage: inMemoryStorage});
  createProfilesStore({storage: inMemoryStorage});
});

const services: ConnectionService[] = [];

async function connected(attachedInputId: string | null): Promise<ConnectionService> {
  const service = new ConnectionService(new StubTransport(attachedInputId));
  services.push(service);
  const connecting = service.connect('out-piano');
  for (let i = 0; i < 20; i++) {
    await jest.advanceTimersByTimeAsync(100);
  }
  await connecting;
  return service;
}

beforeEach(() => {
  useConnectionStore.getState().reset();
  jest.useFakeTimers();
});

afterEach(async () => {
  await Promise.all(services.splice(0).map(service => service.destroy()));
  jest.useRealTimers();
});

describe('ConnectionService records the attached input port', () => {
  it('copies the transport input port id into the store on connect', async () => {
    await connected('in-piano');
    expect(useConnectionStore.getState().inputPortId).toBe('in-piano');
  });

  it('clears it on disconnect', async () => {
    const service = await connected('in-piano');
    await service.disconnect();
    expect(useConnectionStore.getState().inputPortId).toBeNull();
  });

  it('leaves it null for a transport that does not report one', async () => {
    await connected(null);
    expect(useConnectionStore.getState().inputPortId).toBeNull();
  });
});
