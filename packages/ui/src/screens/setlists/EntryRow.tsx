import { useState } from 'react';
import { RowContextMenu, type RowAction } from '../../components/RowContextMenu';
import { useLongPress } from '../../hooks/useLongPress';
import { SceneRow, type SceneAction } from './SceneRow';
import { sceneCountLabel } from './labels';
import type { Scene, Song } from '../../store';

export type EntryAction = 'moveUp' | 'moveDown' | 'remove' | 'customize' | 'revert' | 'promote';

type EntryMenuState =
  | { kind: 'closed' }
  | { kind: 'open'; index: number; x: number; y: number };

interface EntryRowProps {
  resolved: Song | null;
  index: number;
  total: number;
  isLightMode: boolean;
  compact: boolean;
  customized: boolean;
  sharedCount: number;
  onAction: (action: EntryAction, index: number) => void;
  onSceneAction: (
    entryIndex: number,
    action: SceneAction,
    scene: Scene,
    sceneIndex: number,
  ) => Promise<void>;
}

export function EntryRow({
  resolved,
  index,
  total,
  isLightMode,
  compact,
  customized,
  sharedCount,
  onAction,
  onSceneAction,
}: EntryRowProps) {
  const [menu, setMenu] = useState<EntryMenuState>({ kind: 'closed' });
  const [expanded, setExpanded] = useState(false);

  const longPress = useLongPress({
    onLongPress: point => setMenu({ kind: 'open', index, x: point.x, y: point.y }),
  });

  const actions: RowAction[] = resolved
    ? [
        ...(index > 0 ? [{ id: 'moveUp', label: 'Move up' }] : []),
        ...(index < total - 1 ? [{ id: 'moveDown', label: 'Move down' }] : []),
        ...(customized
          ? [
              { id: 'revert', label: 'Revert to library version', destructive: true },
              { id: 'promote', label: 'Push changes to library', destructive: true },
            ]
          : [{ id: 'customize', label: 'Customize for this gig' }]),
        { id: 'remove', label: 'Remove from setlist', destructive: true },
      ]
    : [{ id: 'remove', label: 'Remove from setlist', destructive: true }];

  return (
    <div>
      <div
        onContextMenu={e => {
          e.preventDefault();
          setMenu({ kind: 'open', index, x: e.clientX, y: e.clientY });
        }}
        {...longPress}
        className={`relative flex items-center gap-3 px-4 py-2.5 border-b ${
          isLightMode ? 'border-zinc-100' : 'border-zinc-800/60'
        } ${resolved ? '' : 'opacity-60'}`}
      >
        <div
          onClick={() => resolved && setExpanded(prev => !prev)}
          className={`flex items-center gap-3 flex-1 min-w-0 ${resolved ? 'cursor-pointer' : ''}`}
        >
          <span
            className={`text-xs font-mono w-5 shrink-0 ${
              isLightMode ? 'text-zinc-400' : 'text-zinc-600'
            }`}
          >
            {index + 1}
          </span>
          <span
            className={`text-sm font-semibold truncate ${
              resolved
                ? isLightMode
                  ? 'text-zinc-700'
                  : 'text-zinc-300'
                : isLightMode
                  ? 'text-zinc-400 italic'
                  : 'text-zinc-600 italic'
            }`}
          >
            {resolved ? resolved.name : 'Missing song'}
          </span>
          <span className="ml-auto flex items-center gap-2 shrink-0">
            {resolved ? (
              <>
                <span
                  className={`text-xs ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}
                >
                  {sceneCountLabel(resolved.scenes.length)}
                  {!customized && sharedCount > 1
                    ? ` · ${sharedCount} setlists follow this`
                    : ''}
                </span>
                {customized && (
                  <span
                    className={`text-[10px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded border ${
                      isLightMode
                        ? 'text-amber-600 border-amber-200 bg-amber-50'
                        : 'text-amber-400 border-amber-900/50 bg-amber-950/40'
                    }`}
                  >
                    edited
                  </span>
                )}
              </>
            ) : (
              <span
                className={`text-[10px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded border ${
                  isLightMode
                    ? 'text-red-600 border-red-200 bg-red-50'
                    : 'text-red-400 border-red-900/50 bg-red-950/40'
                }`}
              >
                missing
              </span>
            )}
          </span>
        </div>
        {menu.kind === 'open' && (
          <RowContextMenu
            x={menu.x}
            y={menu.y}
            isLightMode={isLightMode}
            actions={actions}
            onClose={() => setMenu({ kind: 'closed' })}
            onAction={id => {
              setMenu({ kind: 'closed' });
              onAction(id as EntryAction, index);
            }}
          />
        )}
      </div>
      {expanded && resolved && (
        <div className={isLightMode ? 'bg-zinc-50' : 'bg-zinc-950/40'}>
          {resolved.scenes.map((scene, sceneIndex) => (
            <SceneRow
              key={scene.id}
              scene={scene}
              index={sceneIndex}
              total={resolved.scenes.length}
              compact={compact}
              isLightMode={isLightMode}
              allowRecapture={false}
              onAction={(action, actionScene, actionIndex) => {
                onSceneAction(index, action, actionScene, actionIndex).catch(() => {});
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
