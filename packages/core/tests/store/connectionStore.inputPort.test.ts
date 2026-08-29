import {createConnectionStore, useConnectionStore} from '../../src/store/connectionStore';
import {inMemoryStorage} from '../../src/store/storage';

beforeAll(() => {
  createConnectionStore({storage: inMemoryStorage});
});

beforeEach(() => {
  useConnectionStore.getState().reset();
});

describe('connectionStore.inputPortId', () => {
  it('starts null', () => {
    expect(useConnectionStore.getState().inputPortId).toBeNull();
  });

  it('records the attached input port', () => {
    useConnectionStore.getState().setInputPort('in-piano');
    expect(useConnectionStore.getState().inputPortId).toBe('in-piano');
  });

  it('clears back to null', () => {
    useConnectionStore.getState().setInputPort('in-piano');
    useConnectionStore.getState().setInputPort(null);
    expect(useConnectionStore.getState().inputPortId).toBeNull();
  });

  it('is dropped by reset', () => {
    useConnectionStore.getState().setInputPort('in-piano');
    useConnectionStore.getState().reset();
    expect(useConnectionStore.getState().inputPortId).toBeNull();
  });

  it('is not persisted', () => {
    useConnectionStore.getState().setInputPort('in-piano');
    const raw = inMemoryStorage.getItem('pianel:connection');
    expect(typeof raw).toBe('string');
    expect(raw as string).not.toContain('inputPortId');
  });
});
