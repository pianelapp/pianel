/**
 * PresetContextMenu — overlay menu (Update / Rename / Delete) shown when the
 * user right-clicks a filled preset. Anchored at the click coordinates;
 * closes on outside click or Escape.
 */

import { useEffect, useRef } from 'react';

interface PresetContextMenuProps {
  x: number;
  y: number;
  isLightMode: boolean;
  onClose: () => void;
  onAction: (action: 'update' | 'rename' | 'delete') => void;
}

const ITEMS: Array<{ id: 'update' | 'rename' | 'delete'; label: string }> = [
  { id: 'update', label: 'Update' },
  { id: 'rename', label: 'Rename' },
  { id: 'delete', label: 'Delete' },
];

export function PresetContextMenu({
  x,
  y,
  isLightMode,
  onClose,
  onAction,
}: PresetContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ position: 'fixed', top: y, left: x }}
      className={`z-50 min-w-[140px] rounded-xl border shadow-lg overflow-hidden ${
        isLightMode
          ? 'bg-white border-zinc-200'
          : 'bg-zinc-900 border-zinc-800'
      }`}
    >
      {ITEMS.map(item => (
        <button
          key={item.id}
          role="menuitem"
          onClick={() => onAction(item.id)}
          className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
            isLightMode
              ? 'text-zinc-700 hover:bg-zinc-100'
              : 'text-zinc-200 hover:bg-zinc-800'
          } ${
            item.id === 'delete'
              ? isLightMode
                ? 'text-red-600 hover:bg-red-50'
                : 'text-red-400 hover:bg-red-950/30'
              : ''
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
