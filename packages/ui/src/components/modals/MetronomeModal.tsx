import React, { useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import X from 'lucide-react/dist/esm/icons/x';
import { usePiano } from '../../hooks/usePiano';
import { PatternGlyph } from './PatternIcons';
import { METRONOME_PATTERN_SHAPES } from '@pianel/core/helpers/metronomePatterns';
import type { PatternShape } from '@pianel/core/types/metronomePatterns';

const BEAT_OPTIONS = [
  { value: 0, label: '0/4', subtitle: 'Free' },
  { value: 1, label: '2/4' },
  { value: 2, label: '3/4' },
  { value: 3, label: '4/4' },
  { value: 4, label: '5/4' },
  { value: 5, label: '6/4' },
] as const;

interface PatternOption {
  value: number;
  label?: string;
  shape?: PatternShape;
  ariaLabel: string;
}

// Slot 0 = Off (text). Slots 1–7 use the shared glyph shapes from @pianel/core.
const PATTERN_OPTIONS: PatternOption[] = [
  { value: 0, label: 'Off', ariaLabel: 'Pattern off' },
  ...METRONOME_PATTERN_SHAPES.map((shape) => ({
    value: shape.value,
    shape,
    ariaLabel: shape.ariaLabel,
  })),
];

const TONE_OPTIONS = [
  { value: 0, label: 'Click' },
  { value: 1, label: 'Electronic' },
  { value: 2, label: 'Japanese' },
  { value: 3, label: 'English' },
] as const;

interface MetronomeModalProps {
  open: boolean;
  onClose: () => void;
  isLightMode: boolean;
}

export function MetronomeModal({ open, onClose, isLightMode }: MetronomeModalProps) {
  const {
    metronomeBeat,
    metronomePattern,
    metronomeVolume,
    metronomeTone,
    changeMetronomeParam,
  } = usePiano();

  const handleVolumeDecrement = useCallback(() => {
    const next = Math.max(0, metronomeVolume - 1);
    if (next !== metronomeVolume) changeMetronomeParam('volume', next);
  }, [metronomeVolume, changeMetronomeParam]);

  const handleVolumeIncrement = useCallback(() => {
    const next = Math.min(10, metronomeVolume + 1);
    if (next !== metronomeVolume) changeMetronomeParam('volume', next);
  }, [metronomeVolume, changeMetronomeParam]);

  const overlayClass = isLightMode
    ? 'bg-black/30 backdrop-blur-sm'
    : 'bg-black/60 backdrop-blur-sm';

  const contentClass = isLightMode
    ? 'bg-white/95 border-zinc-200 text-zinc-800'
    : 'bg-zinc-900/95 border-zinc-800 text-zinc-200';

  const dividerClass = isLightMode ? 'border-zinc-200' : 'border-zinc-800';
  const headerBgClass = isLightMode ? 'bg-zinc-50/80' : 'bg-zinc-950/80';
  const sectionLabelClass = isLightMode ? 'text-zinc-500' : 'text-zinc-500';

  const chipBase =
    'min-w-[64px] px-3 py-2.5 rounded-lg font-mono text-sm tabular-nums transition-colors border flex flex-col items-center justify-center';
  const chipInactive = isLightMode
    ? 'bg-white border-zinc-200 hover:bg-zinc-100 text-zinc-700'
    : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-200';
  const chipActive = isLightMode
    ? 'bg-cyan-50 border-cyan-500 text-cyan-700'
    : 'bg-cyan-900/30 border-cyan-500 text-cyan-300';

  const stepperButtonClass = isLightMode
    ? 'bg-white border-zinc-200 hover:bg-zinc-100 text-zinc-700 disabled:opacity-40'
    : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-200 disabled:opacity-40';

  const renderChip = <T extends number>(
    option: { value: T; label: string; subtitle?: string },
    selected: T,
    onSelect: (value: T) => void,
  ) => {
    const isSelected = option.value === selected;
    return (
      <button
        key={option.value}
        onClick={() => onSelect(option.value)}
        className={`${chipBase} ${isSelected ? chipActive : chipInactive}`}
      >
        <span className={isSelected ? 'font-bold' : ''}>{option.label}</span>
        {option.subtitle && (
          <span className={`text-[9px] mt-0.5 ${isSelected ? 'opacity-80' : isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {option.subtitle}
          </span>
        )}
      </button>
    );
  };

  const patternChipBase =
    'w-[64px] h-[52px] rounded-lg transition-colors border flex items-center justify-center';

  const renderPatternChip = (option: PatternOption) => {
    const isSelected = option.value === metronomePattern;
    const content = option.shape ? (
      <PatternGlyph shape={option.shape} className="w-9 h-7" />
    ) : (
      <span className={`font-mono text-sm ${isSelected ? 'font-bold' : ''}`}>{option.label}</span>
    );
    return (
      <button
        key={option.value}
        onClick={() => changeMetronomeParam('pattern', option.value)}
        className={`${patternChipBase} ${isSelected ? chipActive : chipInactive}`}
        aria-label={option.ariaLabel}
        aria-pressed={isSelected}
      >
        {content}
      </button>
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 z-50 flex items-center justify-center ${overlayClass}`}>
          <Dialog.Content
            className={`relative w-[640px] max-w-[92vw] max-h-[85vh] rounded-2xl shadow-2xl border flex flex-col overflow-hidden transition-colors ${contentClass}`}
            aria-label="Metronome Settings"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className={`flex items-center justify-between px-6 py-5 border-b shrink-0 ${headerBgClass} ${dividerClass}`}>
              <Dialog.Title className={`text-sm font-bold tracking-widest uppercase ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`}>
                Metronome Settings
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-zinc-500/20 transition-colors"
                  aria-label="Close"
                >
                  <X className={`w-4 h-4 ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`} />
                </button>
              </Dialog.Close>
            </div>

            <div className="px-6 py-5 overflow-y-auto custom-scrollbar flex flex-col gap-5">
              <section>
                <span className={`block text-[10px] font-bold tracking-widest uppercase mb-2 ${sectionLabelClass}`}>
                  Beat
                </span>
                <div className="flex flex-wrap gap-2">
                  {BEAT_OPTIONS.map((opt) =>
                    renderChip(opt, metronomeBeat as typeof opt.value, (v) => changeMetronomeParam('beat', v)),
                  )}
                </div>
              </section>

              <section>
                <span className={`block text-[10px] font-bold tracking-widest uppercase mb-2 ${sectionLabelClass}`}>
                  Pattern
                </span>
                <div className="flex flex-wrap gap-2">
                  {PATTERN_OPTIONS.map(renderPatternChip)}
                </div>
              </section>

              <section>
                <span className={`block text-[10px] font-bold tracking-widest uppercase mb-2 ${sectionLabelClass}`}>
                  Metronome Volume
                </span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleVolumeDecrement}
                    disabled={metronomeVolume === 0}
                    className={`w-11 h-11 rounded-lg border font-mono text-xl transition-colors ${stepperButtonClass}`}
                    aria-label="Decrease metronome volume"
                  >
                    −
                  </button>
                  <span
                    className={`font-mono text-3xl tabular-nums min-w-[48px] text-center ${isLightMode ? 'text-cyan-700' : 'text-cyan-300'}`}
                  >
                    {metronomeVolume}
                  </span>
                  <button
                    onClick={handleVolumeIncrement}
                    disabled={metronomeVolume === 10}
                    className={`w-11 h-11 rounded-lg border font-mono text-xl transition-colors ${stepperButtonClass}`}
                    aria-label="Increase metronome volume"
                  >
                    +
                  </button>
                </div>
              </section>

              <section>
                <span className={`block text-[10px] font-bold tracking-widest uppercase mb-2 ${sectionLabelClass}`}>
                  Metronome Tone
                </span>
                <div className="flex flex-wrap gap-2">
                  {TONE_OPTIONS.map((opt) =>
                    renderChip(opt, metronomeTone as typeof opt.value, (v) => changeMetronomeParam('tone', v)),
                  )}
                </div>
              </section>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
