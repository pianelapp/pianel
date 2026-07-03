import React from 'react';

interface HardwareButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
  active?: boolean;
  disabled?: boolean;
  isLightMode?: boolean;
}

export function HardwareButton({
  children,
  onClick,
  onContextMenu,
  className = '',
  active = false,
  disabled = false,
  isLightMode = false,
}: HardwareButtonProps) {
  const baseStyles = isLightMode
    ? 'bg-gradient-to-b from-white to-zinc-200 border-zinc-300 shadow-[0_4px_0_#a1a1aa,0_5px_10px_rgba(0,0,0,0.1)] active:shadow-[0_0px_0_#a1a1aa,0_2px_5px_rgba(0,0,0,0.1)] text-zinc-700'
    : 'bg-gradient-to-b from-zinc-700 to-zinc-800 border-zinc-600 shadow-[0_4px_0_#18181b,0_5px_10px_rgba(0,0,0,0.5)] active:shadow-[0_0px_0_#18181b,0_2px_5px_rgba(0,0,0,0.5)] text-zinc-200';

  const activeStyles = active && isLightMode
    ? 'border-orange-400 bg-orange-50'
    : active && !isLightMode
    ? 'border-orange-500/50'
    : '';

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      disabled={disabled}
      className={`
        flex items-center justify-center
        rounded-lg
        transition-all duration-75
        border
        active:translate-y-[4px]
        disabled:opacity-40 disabled:cursor-not-allowed
        ${baseStyles}
        ${activeStyles}
        ${className}
      `}
    >
      {children}
    </button>
  );
}
