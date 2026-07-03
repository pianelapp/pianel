import React from 'react';

interface DisplayPanelProps {
  children: React.ReactNode;
  headerLabel?: string;
  className?: string;
  isLightMode?: boolean;
}

export function DisplayPanel({
  children,
  headerLabel,
  className = '',
  isLightMode = false,
}: DisplayPanelProps) {
  const panelStyles = isLightMode
    ? 'bg-zinc-200/80 border-zinc-300 shadow-[inset_0_3px_10px_rgba(0,0,0,0.05)]'
    : 'bg-zinc-900/80 border-zinc-800/80 shadow-[inset_0_5px_25px_rgba(0,0,0,0.8)]';

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center
        border-2 rounded-2xl
        transition-colors
        ${panelStyles}
        ${className}
      `}
    >
      {headerLabel && (
        <span className={`absolute top-2 text-xs font-bold tracking-[0.2em] uppercase ${isLightMode ? 'text-zinc-500' : 'text-zinc-500'}`}>
          {headerLabel}
        </span>
      )}
      {children}
    </div>
  );
}
