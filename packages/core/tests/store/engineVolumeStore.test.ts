import {
  useEngineVolumeStore,
  selectEngineVolumeValue,
  selectEngineVolumeAttenuated,
} from '../../src/store/engineVolumeStore';
import * as storeBarrel from '../../src/store/index';

beforeEach(() => {
  useEngineVolumeStore.getState().reset();
});

describe('engineVolumeStore', () => {
  it('starts at position 100 and supported', () => {
    const state = useEngineVolumeStore.getState();
    expect(state.position).toBe(100);
    expect(state.supported).toBe(true);
  });

  it('clamps and rounds every position write', () => {
    const {setPosition} = useEngineVolumeStore.getState();
    setPosition(-1);
    expect(useEngineVolumeStore.getState().position).toBe(0);
    setPosition(101);
    expect(useEngineVolumeStore.getState().position).toBe(100);
    setPosition(50.5);
    expect(useEngineVolumeStore.getState().position).toBe(51);
    setPosition(Number.NaN);
    expect(useEngineVolumeStore.getState().position).toBe(100);
  });

  it('sets the support flag', () => {
    useEngineVolumeStore.getState().setSupported(false);
    expect(useEngineVolumeStore.getState().supported).toBe(false);
  });

  it('reset restores the defaults', () => {
    useEngineVolumeStore.getState().setPosition(20);
    useEngineVolumeStore.getState().setSupported(false);
    useEngineVolumeStore.getState().reset();
    expect(useEngineVolumeStore.getState().position).toBe(100);
    expect(useEngineVolumeStore.getState().supported).toBe(true);
  });

  it('derives the piano value through the curve', () => {
    useEngineVolumeStore.getState().setPosition(50);
    expect(selectEngineVolumeValue(useEngineVolumeStore.getState())).toBe(70);
    useEngineVolumeStore.getState().setPosition(100);
    expect(selectEngineVolumeValue(useEngineVolumeStore.getState())).toBe(127);
  });

  it('reports attenuation only below 100', () => {
    expect(selectEngineVolumeAttenuated(useEngineVolumeStore.getState())).toBe(
      false,
    );
    useEngineVolumeStore.getState().setPosition(99);
    expect(selectEngineVolumeAttenuated(useEngineVolumeStore.getState())).toBe(
      true,
    );
  });

  it('is runtime-only, with no persist middleware', () => {
    expect(
      (useEngineVolumeStore as unknown as {persist?: unknown}).persist,
    ).toBeUndefined();
  });

  it('is exported through the store barrel', () => {
    expect(storeBarrel.useEngineVolumeStore).toBe(useEngineVolumeStore);
    expect(storeBarrel.selectEngineVolumeValue).toBe(selectEngineVolumeValue);
    expect(storeBarrel.selectEngineVolumeAttenuated).toBe(
      selectEngineVolumeAttenuated,
    );
  });
});
