import { useState, useEffect } from 'react';
import { getChordService } from '@pianel/core/services/ChordService';
import type { ChordResult } from '@pianel/core/types/types';

const EMPTY_RESULT: ChordResult = {
  name: '',
  root: null,
  bass: null,
  quality: null,
  annotation: null,
  noteCount: 0,
  notes: [],
};

export function useChord() {
  const [chord, setChord] = useState<ChordResult>(EMPTY_RESULT);

  useEffect(() => {
    const service = getChordService();
    const unsub = service.subscribe(setChord);
    setChord(service.getCurrent());
    return unsub;
  }, []);

  return chord;
}
