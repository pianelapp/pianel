import { useCallback } from 'react';
import {
  selectEngineVolumeAttenuated,
  useEngineVolumeStore,
  usePerformanceStore,
} from '../store';
import { getPianoService } from './usePiano';

export interface OutputVolumeView {
  position: number;
}

export interface EngineVolumeView {
  position: number;
  attenuated: boolean;
  available: boolean;
}

export interface UseMasterVolume {
  output: OutputVolumeView;
  engine: EngineVolumeView;
  changeOutputVolume: (position: number) => void;
  changeEngineVolume: (position: number) => void;
}

const OUTPUT_VOLUME_MIN = 0;
const OUTPUT_VOLUME_MAX = 100;

function clampOutputVolume(position: number): number {
  if (!Number.isFinite(position)) return OUTPUT_VOLUME_MIN;
  return Math.max(
    OUTPUT_VOLUME_MIN,
    Math.min(OUTPUT_VOLUME_MAX, Math.round(position)),
  );
}

export function useMasterVolume(): UseMasterVolume {
  const outputPosition = usePerformanceStore(s => s.outputVolume);
  const enginePosition = useEngineVolumeStore(s => s.position);
  const attenuated = useEngineVolumeStore(selectEngineVolumeAttenuated);
  const available = useEngineVolumeStore(s => s.supported);

  const changeOutputVolume = useCallback((position: number) => {
    const service = getPianoService();
    if (!service) {
      usePerformanceStore.getState().setOutputVolume(clampOutputVolume(position));
      return;
    }
    service.changeOutputVolume(position).catch(() => undefined);
  }, []);

  const changeEngineVolume = useCallback((position: number) => {
    const service = getPianoService();
    if (!service) {
      useEngineVolumeStore.getState().setPosition(position);
      return;
    }
    service.setEngineVolume(position);
  }, []);

  return {
    output: { position: outputPosition },
    engine: { position: enginePosition, attenuated, available },
    changeOutputVolume,
    changeEngineVolume,
  };
}
