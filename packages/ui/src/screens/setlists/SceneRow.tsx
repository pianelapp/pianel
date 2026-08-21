import { useState } from 'react';
import { RowContextMenu, type RowAction } from '../../components/RowContextMenu';
import { useLongPress } from '../../hooks/useLongPress';
import { useTones } from '../../hooks/useTones';
import { summariseScene } from '../../helpers/sceneSummary';
import { sceneBadgeClass } from '../../helpers/sceneBadge';
import type { Scene } from '../../store';

export type SceneAction =
  | 'rename'
  | 'notes'
  | 'recapture'
  | 'moveUp'
  | 'moveDown'
  | 'delete'
  | 'saveAsPad';

interface SceneRowProps {
  scene: Scene;
  index: number;
  total: number;
  compact: boolean;
  isLightMode: boolean;
  nested?: boolean;
  onAction: (id: SceneAction, scene: Scene, index: number) => void;
}

type MenuState = { kind: 'closed' } | { kind: 'open'; x: number; y: number };

export function SceneRow({
  scene,
  index,
  total,
  compact,
  isLightMode,
  nested = false,
  onAction,
}: SceneRowProps) {
  const { findToneById } = useTones();
  const [menu, setMenu] = useState<MenuState>({ kind: 'closed' });
  const summary = summariseScene(scene.snapshot, id => findToneById(id)?.name);

  const longPress = useLongPress({
    onLongPress: point => setMenu({ kind: 'open', x: point.x, y: point.y }),
  });

  const actions: RowAction[] = [
    { id: 'rename', label: 'Rename' },
    { id: 'notes', label: 'Notes' },
    { id: 'saveAsPad', label: 'Save scene as pad' },
    { id: 'recapture', label: 'Re-capture' },
    ...(index > 0 ? [{ id: 'moveUp', label: 'Move up' }] : []),
    ...(index < total - 1 ? [{ id: 'moveDown', label: 'Move down' }] : []),
    { id: 'delete', label: 'Delete', destructive: true },
  ];

  const badgeClass = `${sceneBadgeClass(summary.modeLabel, isLightMode)} shrink-0`;

  return (
    <div
      onContextMenu={e => {
        e.preventDefault();
        setMenu({ kind: 'open', x: e.clientX, y: e.clientY });
      }}
      {...longPress}
      className={`flex items-center gap-3 border-b transition-colors ${
        nested ? 'pl-11 pr-4 py-2.5' : 'px-4 py-3'
      } ${
        isLightMode
          ? 'border-zinc-100 hover:bg-zinc-100 active:bg-zinc-200'
          : 'border-zinc-800/60 hover:bg-zinc-800/40 active:bg-zinc-800/70'
      }`}
    >
      <span
        className={`font-mono w-5 shrink-0 ${nested ? 'text-[10px]' : 'text-xs'} ${
          isLightMode ? 'text-zinc-400' : 'text-zinc-600'
        }`}
      >
        {index + 1}
      </span>
      <span
        className={`min-w-0 truncate ${
          nested
            ? `text-xs font-normal ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`
            : `text-sm font-semibold ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`
        }`}
      >
        {scene.label}
      </span>
      {scene.notes && (
        <span
          title="has notes"
          className={`text-xs shrink-0 ${
            isLightMode ? 'text-amber-600' : 'text-amber-400'
          }`}
        >
          ♪
        </span>
      )}
      <span className="ml-auto flex items-center gap-2 shrink-0">
        {!compact && (
          <span className="flex flex-col items-end leading-tight">
            {summary.tones.map((tone, toneIndex) => (
              <span
                key={toneIndex}
                className="text-xs text-zinc-500 truncate max-w-[150px]"
              >
                {tone.glyph}
                {tone.name}
              </span>
            ))}
          </span>
        )}
        {!compact && summary.splitPoint && (
          <span className="text-xs text-zinc-500">{summary.splitPoint}</span>
        )}
        <span className={badgeClass}>{summary.modeLabel}</span>
      </span>
      {menu.kind === 'open' && (
        <RowContextMenu
          x={menu.x}
          y={menu.y}
          isLightMode={isLightMode}
          actions={actions}
          onClose={() => setMenu({ kind: 'closed' })}
          onAction={id => {
            setMenu({ kind: 'closed' });
            onAction(id as SceneAction, scene, index);
          }}
        />
      )}
    </div>
  );
}
