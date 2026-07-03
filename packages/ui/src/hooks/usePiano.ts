import { useCallback } from 'react';
import type { PianoService } from '@pianel/core/services/PianoService';
import { usePerformanceStore } from '../store';

let pianoServiceInstance: PianoService | null = null;

export function setPianoService(service: PianoService): void {
  pianoServiceInstance = service;
}

export function getPianoService(): PianoService | null {
  return pianoServiceInstance;
}

export function usePiano() {
  const volume = usePerformanceStore(s => s.volume);
  const tempo = usePerformanceStore(s => s.tempo);
  const metronomeOn = usePerformanceStore(s => s.metronomeOn);
  const headphonesConnected = usePerformanceStore(s => s.headphonesConnected);
  const metronomeBeat = usePerformanceStore(s => s.metronomeBeat);
  const metronomePattern = usePerformanceStore(s => s.metronomePattern);
  const metronomeVolume = usePerformanceStore(s => s.metronomeVolume);
  const metronomeTone = usePerformanceStore(s => s.metronomeTone);
  const activeTone = usePerformanceStore(s => s.activeTone);

  const changeVolume = useCallback(async (value: number) => {
    usePerformanceStore.getState().setVolume(value);
    const service = getPianoService();
    if (!service) return;
    await service.changeVolume(value);
  }, []);

  const changeTempo = useCallback(async (bpm: number) => {
    usePerformanceStore.getState().setTempo(bpm);
    const service = getPianoService();
    if (!service) return;
    await service.changeTempo(bpm);
  }, []);

  const toggleMetronome = useCallback(async () => {
    const service = getPianoService();
    if (!service) return;
    await service.toggleMetronome();
  }, []);

  const changeMetronomeParam = useCallback(
    async (param: 'beat' | 'pattern' | 'volume' | 'tone', value: number) => {
      const store = usePerformanceStore.getState();
      switch (param) {
        case 'beat': store.setMetronomeBeat(value); break;
        case 'pattern': store.setMetronomePattern(value); break;
        case 'volume': store.setMetronomeVolume(value); break;
        case 'tone': store.setMetronomeTone(value); break;
      }
      const service = getPianoService();
      if (!service) return;
      await service.changeMetronomeParam(param, value);
    },
    [],
  );

  return {
    volume,
    tempo,
    metronomeOn,
    headphonesConnected,
    metronomeBeat,
    metronomePattern,
    metronomeVolume,
    metronomeTone,
    activeTone,
    changeVolume,
    changeTempo,
    toggleMetronome,
    changeMetronomeParam,
  };
}
