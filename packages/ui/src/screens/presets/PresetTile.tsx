/**
 * PresetTile — single 4×2-grid preset slot. Empty state shows a "+" hint;
 * filled state shows the LCD-font label. Click applies; right-click opens
 * the context menu (handled by parent).
 */

import type { Preset } from '../../store';
import { useLongPress, type LongPressPoint } from '../../hooks/useLongPress';

interface PresetTileProps {
  position: number;
  preset: Preset | null;
  isLightMode: boolean;
  className?: string;
  onClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  /**
   * Touch long-press equivalent of the desktop right-click. Enabled only for
   * filled tiles; empty tiles keep the recognizer inert so an empty-tile
   * long-press takes no secondary action and never triggers the primary apply.
   */
  onLongPress?: (point: LongPressPoint) => void;
}

export function PresetTile({
  position,
  preset,
  isLightMode,
  className,
  onClick,
  onContextMenu,
  onLongPress,
}: PresetTileProps) {
  const longPress = useLongPress({
    enabled: preset !== null && onLongPress !== undefined,
    onLongPress: point => onLongPress?.(point),
  });

  if (!preset) {
    return (
      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        aria-label={`Empty preset ${position + 1}`}
        className={`flex items-center justify-center rounded-[1rem] border-2 border-dashed transition-all active:scale-[0.97] ${
          isLightMode
            ? 'border-zinc-300 bg-zinc-50/50 hover:bg-zinc-200/50 text-zinc-400'
            : 'border-zinc-800 bg-transparent hover:bg-zinc-800/30 text-zinc-700'
        } ${className ?? ''}`}
      >
        <span className="font-bold tracking-widest text-sm uppercase">+ Empty</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      {...longPress}
      aria-label={`Apply preset "${preset.label}"`}
      className={`
        flex flex-col items-center justify-center p-2 rounded-[1rem] border-2
        transition-all duration-75 active:translate-y-[2px]
        ${
          isLightMode
            ? 'bg-gradient-to-b from-[#E9F0F8] to-[#D5E1EE] border-[#9DB4CE] shadow-[0_3px_0_#A8BDD4,0_4px_8px_rgba(0,0,0,0.1)] active:shadow-[0_0px_0_#A8BDD4,0_2px_4px_rgba(0,0,0,0.1)] text-zinc-800'
            : 'bg-gradient-to-b from-zinc-800 to-zinc-900 border-cyan-800/80 shadow-[0_3px_0_#112933,inset_0_0_15px_rgba(6,182,212,0.15)] active:shadow-[0_0px_0_#112933,inset_0_0_15px_rgba(6,182,212,0.15)] text-cyan-50'
        }
        ${className ?? ''}
      `}
    >
      <span
        className={`text-xl font-bold tracking-wide truncate max-w-full px-2 ${
          isLightMode
            ? 'text-zinc-800'
            : 'text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]'
        }`}
      >
        {preset.label}
      </span>
      <span
        className={`text-[10px] mt-1 leading-tight font-medium ${
          isLightMode ? 'text-[#6A88A8]' : 'text-cyan-500/80'
        }`}
      >
        PRESET {position + 1}
      </span>
    </button>
  );
}
