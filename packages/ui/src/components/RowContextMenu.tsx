import { useRef } from 'react';
import { useClampedMenuPosition } from '../hooks/useClampedMenuPosition';
import { useDismissable } from '../hooks/useDismissable';

export type RowAction = { id: string; label: string; destructive?: boolean; disabled?: boolean };

interface RowContextMenuProps {
  x: number;
  y: number;
  actions: RowAction[];
  isLightMode: boolean;
  onClose: () => void;
  onAction: (id: string) => void;
}

export function RowContextMenu({
  x,
  y,
  actions,
  isLightMode,
  onClose,
  onAction,
}: RowContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { top, left } = useClampedMenuPosition(x, y, ref);
  useDismissable(ref, onClose);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ position: 'fixed', top, left }}
      className={`z-50 min-w-[140px] rounded-xl border shadow-lg overflow-hidden ${
        isLightMode
          ? 'bg-white border-zinc-200'
          : 'bg-zinc-900 border-zinc-800'
      }`}
    >
      {actions.map(action => (
        <button
          key={action.id}
          role="menuitem"
          disabled={action.disabled}
          onClick={() => !action.disabled && onAction(action.id)}
          className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
            action.disabled
              ? isLightMode
                ? 'text-zinc-400 cursor-default'
                : 'text-zinc-600 cursor-default'
              : isLightMode
              ? 'text-zinc-700 hover:bg-zinc-100'
              : 'text-zinc-200 hover:bg-zinc-800'
          } ${
            !action.disabled && action.destructive
              ? isLightMode
                ? 'text-red-600 hover:bg-red-50'
                : 'text-red-400 hover:bg-red-950/30'
              : ''
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
