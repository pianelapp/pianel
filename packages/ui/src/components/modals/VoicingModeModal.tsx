import React from 'react';
import type { VoicingMode } from '@pianel/core/types/voicingMode';

interface VoicingModeModalProps {
  open: boolean;
  onClose: () => void;
  isLightMode: boolean;
  currentMode: VoicingMode;
  onSelect: (mode: VoicingMode) => void;
}

const MODES: { value: VoicingMode; label: string; hint: string }[] = [
  { value: 'single', label: 'SINGLE', hint: 'One tone across the keyboard' },
  { value: 'dual', label: 'DUAL', hint: 'Two tones layered together' },
  { value: 'split', label: 'SPLIT', hint: 'Left / right hand zones' },
  { value: 'twin', label: 'TWIN', hint: 'Two equal halves (Pair speakers)' },
];

export function VoicingModeModal({
  open,
  onClose,
  isLightMode,
  currentMode,
  onSelect,
}: VoicingModeModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-[420px] max-w-[92vw] rounded-2xl border shadow-2xl p-6 ${
          isLightMode ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <div className="flex items-center justify-between mb-5">
          <h2
            className={`font-mono text-lg uppercase tracking-widest ${
              isLightMode ? 'text-zinc-700' : 'text-zinc-300'
            }`}
          >
            Voicing Mode
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className={`text-xs font-bold tracking-widest px-2 py-1 rounded ${
              isLightMode
                ? 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`}
          >
            CLOSE
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {MODES.map(m => {
            const active = m.value === currentMode;
            return (
              <button
                key={m.value}
                onClick={() => {
                  onSelect(m.value);
                  onClose();
                }}
                className={`flex flex-col items-start gap-1 p-4 rounded-xl border-2 transition-all text-left ${
                  active
                    ? isLightMode
                      ? 'border-cyan-600 bg-cyan-50'
                      : 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_18px_rgba(6,182,212,0.4)]'
                    : isLightMode
                      ? 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'
                      : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/30'
                }`}
              >
                <span
                  className={`font-mono text-xl uppercase tracking-widest ${
                    active
                      ? isLightMode
                        ? 'text-cyan-700'
                        : 'text-cyan-300 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]'
                      : isLightMode
                        ? 'text-zinc-800'
                        : 'text-zinc-200'
                  }`}
                >
                  {m.label}
                </span>
                <span
                  className={`text-xs ${
                    isLightMode ? 'text-zinc-500' : 'text-zinc-400'
                  }`}
                >
                  {m.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
