import {create} from 'zustand';
import {
  DEFAULT_ENGINE_VOLUME_POSITION,
  ENGINE_VOLUME_MAX_POSITION,
  clampEngineVolumePosition,
  engineVolumeValueForPosition,
} from '../helpers/engineVolume';

export interface EngineVolumeState {
  position: number;
  supported: boolean;
}

export interface EngineVolumeActions {
  setPosition: (position: number) => void;
  setSupported: (supported: boolean) => void;
  reset: () => void;
}

export const useEngineVolumeStore = create<
  EngineVolumeState & EngineVolumeActions
>()(set => ({
  position: DEFAULT_ENGINE_VOLUME_POSITION,
  supported: true,

  setPosition: position =>
    set({position: clampEngineVolumePosition(position)}),

  setSupported: supported => set({supported}),

  reset: () =>
    set({position: DEFAULT_ENGINE_VOLUME_POSITION, supported: true}),
}));

export function selectEngineVolumeValue(state: EngineVolumeState): number {
  return engineVolumeValueForPosition(state.position);
}

export function selectEngineVolumeAttenuated(
  state: EngineVolumeState,
): boolean {
  return state.position < ENGINE_VOLUME_MAX_POSITION;
}
