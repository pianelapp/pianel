import React from 'react';
import Piano from 'lucide-react/dist/esm/icons/piano';
import type { VoicingMode } from '@pianel/core/types/voicingMode';

const MODE_LABELS: Record<VoicingMode, string> = {
  single: 'SINGLE',
  dual: 'DUAL',
  split: 'SPLIT',
  twin: 'TWIN',
};

interface VoicingModeButtonProps {
  mode: VoicingMode;
  isLightMode: boolean;
  onClick: () => void;
  compact?: boolean;
}

/**
 * Status-bar mode button.
 *
 * Square Piano-icon button that displays the active voicing mode name
 * (replaces the static "MODE" placeholder from the sketch). In compact mode the
 * name is hidden and only the icon box renders; the aria-label keeps the
 * accessible name.
 */
export function VoicingModeButton({
  mode,
  isLightMode,
  onClick,
  compact = false,
}: VoicingModeButtonProps) {
  const label = MODE_LABELS[mode];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Voicing mode: ${label}. Click to change.`}
      className={`${compact ? 'tap-target ' : ''}flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
        isLightMode ? 'hover:bg-zinc-200' : 'hover:bg-zinc-800'
      }`}>
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-md border ${
          isLightMode
            ? 'border-zinc-300 bg-zinc-100'
            : 'border-zinc-700 bg-zinc-900/70'
        }`}>
        <Piano
          className={`w-4 h-4 ${
            isLightMode ? 'text-zinc-700' : 'text-zinc-300'
          }`}
        />
      </span>
      {!compact && (
        <span
          className={`font-mono text-xl uppercase tracking-widest ${
            isLightMode ? 'text-zinc-700' : 'text-zinc-300'
          }`}>
          {label}
        </span>
      )}
    </button>
  );
}
