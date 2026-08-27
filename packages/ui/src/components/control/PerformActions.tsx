import {useMemo} from 'react';
import {usePerformCursor} from '../../hooks/usePerformCursor';
import {useRegisterControlActions} from '../../hooks/useControlActions';
import type {ControlAction} from '../../store';

export function PerformActions() {
  const {nextScene, prevScene, nextSong, prevSong, exit, beginScenePeek} =
    usePerformCursor();

  const actions = useMemo<ControlAction[]>(
    () => [
      {
        id: 'perform.nextScene',
        label: 'Next scene',
        group: 'Perform',
        behaviours: ['press', 'release', 'peek'],
        run: nextScene,
        beginPeek: () => beginScenePeek(1),
      },
      {
        id: 'perform.prevScene',
        label: 'Previous scene',
        group: 'Perform',
        behaviours: ['press', 'release', 'peek'],
        run: prevScene,
        beginPeek: () => beginScenePeek(-1),
      },
      {
        id: 'perform.nextSong',
        label: 'Next song',
        group: 'Perform',
        behaviours: ['press', 'release'],
        run: nextSong,
      },
      {
        id: 'perform.prevSong',
        label: 'Previous song',
        group: 'Perform',
        behaviours: ['press', 'release'],
        run: prevSong,
      },
      {
        id: 'perform.exit',
        label: 'Exit perform',
        group: 'Perform',
        behaviours: ['press'],
        run: async () => {
          exit();
        },
      },
    ],
    [nextScene, prevScene, nextSong, prevSong, exit, beginScenePeek],
  );

  useRegisterControlActions(actions);

  return null;
}
