import {useEngineVolumeStore, usePerformanceStore} from '@pianel/core/store';
import type {PianoService} from '@pianel/core/services/PianoService';
import {actSync, renderHook} from '../utils/renderHook';
import {initTestStores} from '../utils/stores';
import {setPianoService} from '../../src/hooks/usePiano';
import {useMasterVolume} from '../../src/hooks/useMasterVolume';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  setPianoService(null as unknown as PianoService);
  useEngineVolumeStore.getState().reset();
  usePerformanceStore.getState().setOutputVolume(100);
});

describe('useMasterVolume', () => {
  it('follows Output Volume notifications from the piano', () => {
    const hook = renderHook(() => useMasterVolume());
    expect(hook.current.output.position).toBe(100);
    actSync(() => usePerformanceStore.getState().setOutputVolume(63));
    expect(hook.current.output.position).toBe(63);
    hook.unmount();
  });

  it('starts Engine Volume at 100, available and not attenuated', () => {
    const hook = renderHook(() => useMasterVolume());
    expect(hook.current.engine).toEqual({
      position: 100,
      attenuated: false,
      available: true,
    });
    hook.unmount();
  });

  it('updates Engine Volume immediately with no piano service', () => {
    const hook = renderHook(() => useMasterVolume());
    actSync(() => hook.current.changeEngineVolume(42));
    expect(hook.current.engine.position).toBe(42);
    expect(hook.current.engine.attenuated).toBe(true);
    expect(useEngineVolumeStore.getState().position).toBe(42);
    actSync(() => hook.current.changeEngineVolume(140));
    expect(hook.current.engine.position).toBe(100);
    expect(hook.current.engine.attenuated).toBe(false);
    hook.unmount();
  });

  it('updates Output Volume in the store with no piano service', () => {
    const hook = renderHook(() => useMasterVolume());
    actSync(() => hook.current.changeOutputVolume(30));
    expect(hook.current.output.position).toBe(30);
    actSync(() => hook.current.changeOutputVolume(-4));
    expect(hook.current.output.position).toBe(0);
    hook.unmount();
  });

  it('reports availability from the engine support flag', () => {
    const hook = renderHook(() => useMasterVolume());
    actSync(() => useEngineVolumeStore.getState().setSupported(false));
    expect(hook.current.engine.available).toBe(false);
    actSync(() => useEngineVolumeStore.getState().setSupported(true));
    expect(hook.current.engine.available).toBe(true);
    hook.unmount();
  });

  it('is attenuated only below 100', () => {
    const hook = renderHook(() => useMasterVolume());
    actSync(() => useEngineVolumeStore.getState().setPosition(99));
    expect(hook.current.engine.attenuated).toBe(true);
    actSync(() => useEngineVolumeStore.getState().setPosition(100));
    expect(hook.current.engine.attenuated).toBe(false);
    hook.unmount();
  });

  it('delegates both changes to the piano service when one is registered', () => {
    const setEngineVolume = jest.fn();
    const changeOutputVolume = jest.fn().mockResolvedValue(undefined);
    setPianoService({
      setEngineVolume,
      changeOutputVolume,
    } as unknown as PianoService);
    const hook = renderHook(() => useMasterVolume());
    actSync(() => hook.current.changeEngineVolume(55));
    actSync(() => hook.current.changeOutputVolume(66));
    expect(setEngineVolume).toHaveBeenCalledWith(55);
    expect(changeOutputVolume).toHaveBeenCalledWith(66);
    expect(useEngineVolumeStore.getState().position).toBe(100);
    hook.unmount();
  });
});

describe('usePiano', () => {
  it('no longer exposes a master volume value or setter', () => {
    const {usePiano} = jest.requireActual('../../src/hooks/usePiano');
    const hook = renderHook(() => usePiano());
    expect(hook.current).not.toHaveProperty('volume');
    expect(hook.current).not.toHaveProperty('changeVolume');
    hook.unmount();
  });
});
