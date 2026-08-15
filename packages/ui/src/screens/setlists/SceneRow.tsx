import { useState } from 'react';
import { RowContextMenu, type RowAction } from '../../components/RowContextMenu';
import { useLongPress } from '../../hooks/useLongPress';
import { useTones } from '../../hooks/useTones';
import { summariseScene } from '../../helpers/sceneSummary';
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
  allowRecapture?: boolean;
  onAction: (id: SceneAction, scene: Scene, index: number) => void;
}

type MenuState = { kind: 'closed' } | { kind: 'open'; x: number; y: number };

export function SceneRow({
  scene,
  index,
  total,
  compact,
  isLightMode,
  allowRecapture = true,
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
    ...(allowRecapture ? [{ id: 'recapture', label: 'Re-capture' }] : []),
    ...(index > 0 ? [{ id: 'moveUp', label: 'Move up' }] : []),
    ...(index < total - 1 ? [{ id: 'moveDown', label: 'Move down' }] : []),
    { id: 'delete', label: 'Delete', destructive: true },
  ];

  const isPlainBadge = summary.modeLabel === 'SINGLE';
  const badgeClass = `text-[10px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded border shrink-0 ${
    isPlainBadge
      ? isLightMode
        ? 'text-zinc-400 border-zinc-300 bg-transparent'
        : 'text-zinc-600 border-zinc-700 bg-transparent'
      : isLightMode
        ? 'text-cyan-700 border-cyan-200 bg-cyan-50'
        : 'text-cyan-400 border-cyan-700 bg-cyan-950'
  }`;

  const tonesText = summary.tones.map(t => `${t.glyph}${t.name}`).join(' · ');

  return (
    <div
      onContextMenu={e => {
        e.preventDefault();
        setMenu({ kind: 'open', x: e.clientX, y: e.clientY });
      }}
      {...longPress}
      className={`flex items-center gap-3 px-4 py-2.5 border-b ${
        isLightMode ? 'border-zinc-100' : 'border-zinc-800/60'
      }`}
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
          isLightMode ? 'text-zinc-700' : 'text-zinc-300'
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
          <span className="text-xs text-zinc-500 truncate max-w-[160px]">
            {tonesText}
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
