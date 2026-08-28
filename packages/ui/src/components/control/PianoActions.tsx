import { useMemo } from 'react';
import { usePiano } from '../../hooks/usePiano';
import { useRegisterControlActions } from '../../hooks/useControlActions';
import type { ControlAction } from '../../store';

export function PianoActions() {
  const { toggleMetronome } = usePiano();

  const actions = useMemo<ControlAction[]>(
    () => [
      {
        id: 'piano.toggleMetronome',
        label: 'Toggle metronome',
        group: 'Piano',
        behaviours: ['press', 'release'],
        run: toggleMetronome,
      },
    ],
    [toggleMetronome],
  );

  useRegisterControlActions(actions);

  return null;
}
