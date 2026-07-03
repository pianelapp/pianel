import React from 'react';
import Settings2 from 'lucide-react/dist/esm/icons/settings-2';
import type { VoicingMode, ToneSlot } from '@pianel/core/types/voicingMode';
import { toneSlotLabels } from '@pianel/core/helpers/voicingMode';

interface ToneSlotTabsProps {
  mode: VoicingMode;
  activeSlot: ToneSlot;
  onChangeSlot: (slot: ToneSlot) => void;
  onOpenOptions: () => void;
  isLightMode: boolean;
}

/**
 * Tone-slot selector row.
 *
 * - In Dual/Split, renders a two-tab segmented control (Tone 1/Tone 2 or
 *   Upper/Lower) + a gear button that opens the mode-specific options modal.
 * - In Single/Twin, renders nothing.
 *
 * Sits above the Category/Tone steppers in DisplayScreen.
 */
export function ToneSlotTabs({
  mode,
  activeSlot,
  onChangeSlot,
  onOpenOptions,
  isLightMode,
}: ToneSlotTabsProps) {
  if (mode === 'single' || mode === 'twin') return null;

  const labels = toneSlotLabels(mode);

  const tab = (slot: ToneSlot, label: string) => {
    const active = slot === activeSlot;
    return (
      <button
        key={slot}
        type="button"
        onClick={() => onChangeSlot(slot)}
        className={`flex-1 py-2 rounded-md font-mono text-sm uppercase tracking-widest transition-all ${
          active
            ? isLightMode
              ? 'bg-zinc-100 text-cyan-700 shadow-sm'
              : 'bg-zinc-900 text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]'
            : isLightMode
              ? 'text-zinc-500 hover:text-zinc-800'
              : 'text-zinc-500 hover:text-zinc-200'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="w-full max-w-[500px] flex items-center gap-3">
      <div
        className={`flex-1 flex items-center gap-1 p-1 rounded-lg border ${
          isLightMode
            ? 'bg-zinc-200/60 border-zinc-300'
            : 'bg-zinc-950/70 border-zinc-800'
        }`}
      >
        {mode === 'split' ? (
          <>
            {tab('left', labels.left)}
            {tab('right', labels.right)}
          </>
        ) : (
          <>
            {tab('right', labels.right)}
            {tab('left', labels.left)}
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onOpenOptions}
        aria-label={`${mode} mode options`}
        className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
          isLightMode
            ? 'border-zinc-300 hover:bg-zinc-200'
            : 'border-zinc-800 hover:bg-zinc-800/70'
        }`}
      >
        <Settings2
          className={`w-5 h-5 ${
            isLightMode ? 'text-zinc-600' : 'text-zinc-400'
          }`}
        />
      </button>
    </div>
  );
}
