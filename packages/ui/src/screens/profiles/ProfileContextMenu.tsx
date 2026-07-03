/**
 * ProfileContextMenu — overlay menu (Set as Default / Update / Rename /
 * Export / Delete) shown when the user right-clicks a profile row.
 */

import { useEffect, useRef } from 'react';

export type ProfileMenuAction =
  | 'setDefault'
  | 'update'
  | 'rename'
  | 'export'
  | 'delete';

interface ProfileContextMenuProps {
  x: number;
  y: number;
  isLightMode: boolean;
  isDefault: boolean;
  onClose: () => void;
  onAction: (action: ProfileMenuAction) => void;
}

export function ProfileContextMenu({
  x,
  y,
  isLightMode,
  isDefault,
  onClose,
  onAction,
}: ProfileContextMenuProps) {
  const items: Array<{ id: ProfileMenuAction; label: string; disabled?: boolean }> = [
    {
      id: 'setDefault',
      label: isDefault ? '✓ Default at boot' : 'Set as Default',
      disabled: isDefault,
    },
    { id: 'update', label: 'Update' },
    { id: 'rename', label: 'Rename' },
    { id: 'export', label: 'Export' },
    { id: 'delete', label: 'Delete' },
  ];
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
      {items.map(item => (
        <button
          key={item.id}
          role="menuitem"
          disabled={item.disabled}
          onClick={() => !item.disabled && onAction(item.id)}
          className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
            item.disabled
              ? isLightMode
                ? 'text-zinc-400 cursor-default'
                : 'text-zinc-600 cursor-default'
              : isLightMode
              ? 'text-zinc-700 hover:bg-zinc-100'
              : 'text-zinc-200 hover:bg-zinc-800'
          } ${
            !item.disabled && item.id === 'delete'
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
