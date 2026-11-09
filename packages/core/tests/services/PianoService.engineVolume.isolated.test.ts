import type {Transport} from '../../src/transport/types';

const transport: Transport = {
  status: 'connected',
  send: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockReturnValue(() => {}),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  scan: jest.fn().mockResolvedValue(undefined),
  stopScan: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
};

describe('PianoService Engine Volume without an initialised connection store', () => {
  it('never throws and still records the position', async () => {
    let service!: import('../../src/services/PianoService').PianoService;
    let store!: typeof import('../../src/store/engineVolumeStore').useEngineVolumeStore;
    jest.isolateModules(() => {
      const {PianoService} = require('../../src/services/PianoService');
      const {FP30XEngine} = require('../../src/engine/fp30x/FP30XEngine');
      store = require('../../src/store/engineVolumeStore').useEngineVolumeStore;
      service = new PianoService(transport);
      service.setEngine(new FP30XEngine());
    });
    expect(() => service.setEngineVolume(33)).not.toThrow();
    expect(store.getState().position).toBe(33);
    await expect(service.resyncEngineVolume()).resolves.toEqual({
      status: 'skipped',
      reason: 'not-connected',
    });
    expect(transport.send).not.toHaveBeenCalled();
  });
});
