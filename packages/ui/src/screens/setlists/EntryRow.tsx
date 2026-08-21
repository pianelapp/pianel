import { useState } from 'react';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import { RowContextMenu, type RowAction } from '../../components/RowContextMenu';
import { useLongPress } from '../../hooks/useLongPress';
import { statusBadgeClass } from '../../helpers/sceneBadge';
import { SceneRow, type SceneAction } from './SceneRow';
import { sceneCountLabel, setlistCountLabel } from './labels';
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
  libraryMissing: boolean;
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
  libraryMissing,
  sharedCount,
  onAction,
  onSceneAction,
}: EntryRowProps) {
  const [menu, setMenu] = useState<EntryMenuState>({ kind: 'closed' });
  const [expanded, setExpanded] = useState(false);
  const Chevron = expanded ? ChevronDown : ChevronRight;

  const longPress = useLongPress({
    onLongPress: point => setMenu({ kind: 'open', index, x: point.x, y: point.y }),
  });

  const actions: RowAction[] = resolved
    ? [
        ...(index > 0 ? [{ id: 'moveUp', label: 'Move up' }] : []),
        ...(index < total - 1 ? [{ id: 'moveDown', label: 'Move down' }] : []),
        ...(customized
          ? libraryMissing
            ? []
            : [
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
        className={`relative border-b ${
          isLightMode ? 'border-zinc-100' : 'border-zinc-800/60'
        } ${resolved ? '' : 'opacity-60'}`}
      >
        <button
          type="button"
          data-entry-expander
          aria-expanded={resolved ? expanded : undefined}
          aria-disabled={resolved ? undefined : true}
          onClick={() => resolved && setExpanded(prev => !prev)}
          onContextMenu={e => {
            e.preventDefault();
            setMenu({ kind: 'open', index, x: e.clientX, y: e.clientY });
          }}
          {...longPress}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
            resolved ? 'cursor-pointer' : ''
          } ${
            isLightMode
              ? 'hover:bg-zinc-100 active:bg-zinc-200'
              : 'hover:bg-zinc-800/50 active:bg-zinc-800/80'
          }`}
        >
          {resolved ? (
            <Chevron
              aria-hidden
              className={`w-4 h-4 shrink-0 ${
                isLightMode ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            />
          ) : (
            <span aria-hidden className="w-4 shrink-0" />
          )}
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
                    ? ` · ${setlistCountLabel(sharedCount)} follow this`
                    : ''}
                </span>
                {customized && (
                  <span
                    className={statusBadgeClass('amber', isLightMode)}
                  >
                    edited
                  </span>
                )}
              </>
            ) : (
              <span
                className={statusBadgeClass('red', isLightMode)}
              >
                missing
              </span>
            )}
          </span>
        </button>
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
        <div
          className={`border-l-2 ${
            isLightMode
              ? 'bg-zinc-50 border-zinc-300'
              : 'bg-black/40 border-zinc-700'
          }`}
        >
          {resolved.scenes.map((scene, sceneIndex) => (
            <SceneRow
              key={scene.id}
              scene={scene}
              index={sceneIndex}
              total={resolved.scenes.length}
              compact={compact}
              isLightMode={isLightMode}
              nested
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
