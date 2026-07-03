import React, { useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import X from 'lucide-react/dist/esm/icons/x';
import Minus from 'lucide-react/dist/esm/icons/minus';
import Plus from 'lucide-react/dist/esm/icons/plus';
import type { VoicingMode } from '@pianel/core/types/voicingMode';
import {
  SHIFT_UI_MIN_OCTAVES,
  SHIFT_UI_MAX_OCTAVES,
  clampShiftForUi,
  BALANCE_BYTE_MIN,
  BALANCE_BYTE_MAX,
  BALANCE_BYTE_CENTER,
  balanceToLR,
} from '@pianel/core/helpers/voicingMode';
import { useVoicingMode } from '../../hooks/useVoicingMode';

interface VoicingOptionsModalProps {
  open: boolean;
  onClose: () => void;
  isLightMode: boolean;
  mode: VoicingMode;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiNoteName(n: number): string {
  const pc = ((n % 12) + 12) % 12;
  const octave = Math.floor(n / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

interface BalanceSliderProps {
  value: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
  isLightMode: boolean;
}

function BalanceSlider({
  value,
  onChange,
  leftLabel,
  rightLabel,
  isLightMode,
}: BalanceSliderProps) {
  const isCenter = value === BALANCE_BYTE_CENTER;
  const display = balanceToLR(value);

  const sideLabelClass = `text-[10px] font-bold tracking-widest uppercase ${
    isLightMode ? 'text-zinc-500' : 'text-zinc-400'
  }`;

  const sliderStyle = (isLightMode
    ? {
        ['--center-slider-track' as never]: '#d4d4d8',
        ['--center-slider-thumb' as never]: '#0891b2',
        ['--center-slider-thumb-border' as never]: '#155e75',
      }
    : {
        ['--center-slider-track' as never]: '#3f3f46',
        ['--center-slider-thumb' as never]: '#06b6d4',
        ['--center-slider-thumb-border' as never]: '#0e7490',
      }) as React.CSSProperties;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-bold tracking-widest uppercase ${
            isLightMode ? 'text-zinc-500' : 'text-zinc-400'
          }`}
        >
          Balance
        </span>
        <span
          className={`font-mono tabular-nums text-sm min-w-[5ch] text-right ${
            isCenter
              ? isLightMode
                ? 'text-zinc-500'
                : 'text-zinc-500'
              : isLightMode
                ? 'text-cyan-700'
                : 'text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]'
          }`}
        >
          {display}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className={`${sideLabelClass} min-w-[3.5rem] text-right`}>
          {leftLabel}
        </span>
        <div className="relative flex-1 h-7">
          {/* Center tick mark */}
          <div
            className={`pointer-events-none absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-px h-3 ${
              isLightMode ? 'bg-zinc-400' : 'bg-zinc-500'
            }`}
          />
          <input
            type="range"
            min={BALANCE_BYTE_MIN}
            max={BALANCE_BYTE_MAX}
            step={1}
            value={value}
            onChange={e => onChange(parseInt(e.target.value, 10))}
            onDoubleClick={() => onChange(BALANCE_BYTE_CENTER)}
            className="center-slider absolute inset-0"
            style={sliderStyle}
            aria-label="Balance"
          />
        </div>
        <span className={`${sideLabelClass} min-w-[3.5rem] text-left`}>
          {rightLabel}
        </span>
      </div>
    </div>
  );
}

export function VoicingOptionsModal({
  open,
  onClose,
  isLightMode,
  mode,
}: VoicingOptionsModalProps) {
  const {
    balance,
    splitPoint,
    dualT1Shift,
    dualT2Shift,
    splitLeftShift,
    splitRightShift,
    changeBalance,
    changeSplitPoint,
    changeShift,
  } = useVoicingMode();

  const overlayClass = isLightMode
    ? 'bg-black/30 backdrop-blur-sm'
    : 'bg-black/60 backdrop-blur-sm';

  const contentClass = isLightMode
    ? 'bg-white/95 border-zinc-200 text-zinc-800'
    : 'bg-zinc-900/95 border-zinc-800 text-zinc-200';

  const dividerClass = isLightMode ? 'border-zinc-200' : 'border-zinc-800';
  const headerBgClass = isLightMode ? 'bg-zinc-50/80' : 'bg-zinc-950/80';

  const handleSplitPointStep = useCallback(
    (delta: number) => {
      changeSplitPoint(splitPoint + delta);
    },
    [changeSplitPoint, splitPoint],
  );

  const title = `${mode.toUpperCase()} OPTIONS`;

  const stepperRow = (
    label: string,
    value: string,
    onMinus: () => void,
    onPlus: () => void,
    disabledMinus = false,
    disabledPlus = false,
  ) => (
    <div className="flex items-center gap-3">
      <span
        className={`flex-1 text-xs font-bold tracking-widest uppercase ${
          isLightMode ? 'text-zinc-500' : 'text-zinc-400'
        }`}
      >
        {label}
      </span>
      <button
        onClick={onMinus}
        disabled={disabledMinus}
        className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-opacity ${
          isLightMode
            ? 'border-zinc-200 hover:bg-zinc-100'
            : 'border-zinc-800 hover:bg-zinc-800'
        } ${disabledMinus ? 'opacity-30 pointer-events-none' : ''}`}
        aria-label={`Decrease ${label}`}
      >
        <Minus className="w-4 h-4" />
      </button>
      <span
        className={`font-mono tabular-nums text-lg min-w-[5ch] text-center ${
          isLightMode ? 'text-zinc-800' : 'text-zinc-100'
        }`}
      >
        {value}
      </span>
      <button
        onClick={onPlus}
        disabled={disabledPlus}
        className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-opacity ${
          isLightMode
            ? 'border-zinc-200 hover:bg-zinc-100'
            : 'border-zinc-800 hover:bg-zinc-800'
        } ${disabledPlus ? 'opacity-30 pointer-events-none' : ''}`}
        aria-label={`Increase ${label}`}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );

  const shiftFormat = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  const shiftRow = (
    label: string,
    target: 'split-left' | 'split-right' | 'dual-tone1' | 'dual-tone2',
    current: number,
  ) =>
    stepperRow(
      label,
      shiftFormat(current),
      () => changeShift(target, clampShiftForUi(current - 1)),
      () => changeShift(target, clampShiftForUi(current + 1)),
      current <= SHIFT_UI_MIN_OCTAVES,
      current >= SHIFT_UI_MAX_OCTAVES,
    );

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`fixed inset-0 z-50 flex items-center justify-center ${overlayClass}`}
        >
          <Dialog.Content
            className={`relative w-[460px] max-w-[92vw] rounded-3xl shadow-2xl border flex flex-col overflow-hidden transition-colors ${contentClass}`}
            aria-label={title}
            onOpenAutoFocus={e => e.preventDefault()}
          >
            <div
              className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${headerBgClass} ${dividerClass}`}
            >
              <Dialog.Title
                className={`text-sm font-bold tracking-widest uppercase ${
                  isLightMode ? 'text-zinc-700' : 'text-zinc-300'
                }`}
              >
                {title}
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

            <div className="px-6 py-6 flex flex-col gap-4">
              {mode === 'dual' && (
                <>
                  <BalanceSlider
                    value={balance}
                    onChange={changeBalance}
                    leftLabel="Tone 1"
                    rightLabel="Tone 2"
                    isLightMode={isLightMode}
                  />
                  {shiftRow('Tone 1 Shift', 'dual-tone1', dualT1Shift)}
                  {shiftRow('Tone 2 Shift', 'dual-tone2', dualT2Shift)}
                  <div
                    className={`text-[10px] font-mono mt-2 ${
                      isLightMode ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                  >
                    SHIFT {SHIFT_UI_MIN_OCTAVES}…+{SHIFT_UI_MAX_OCTAVES} octaves
                    · double-click balance slider to recenter
                  </div>
                </>
              )}

              {mode === 'split' && (
                <>
                  {stepperRow(
                    'Split Point',
                    `${midiNoteName(splitPoint)} (${splitPoint})`,
                    () => handleSplitPointStep(-1),
                    () => handleSplitPointStep(+1),
                  )}
                  <BalanceSlider
                    value={balance}
                    onChange={changeBalance}
                    leftLabel="Lower"
                    rightLabel="Upper"
                    isLightMode={isLightMode}
                  />
                  {shiftRow('Lower Shift', 'split-left', splitLeftShift)}
                  {shiftRow('Upper Shift', 'split-right', splitRightShift)}
                  <div
                    className={`text-[10px] font-mono mt-2 ${
                      isLightMode ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                  >
                    SPLIT POINT: notes ≥ this value play the Upper tone
                    · SHIFT {SHIFT_UI_MIN_OCTAVES}…+{SHIFT_UI_MAX_OCTAVES} octaves
                  </div>
                </>
              )}

              {mode === 'twin' && (
                <div className="flex flex-col items-start gap-2">
                  <span
                    className={`font-mono text-sm ${
                      isLightMode ? 'text-zinc-700' : 'text-zinc-300'
                    }`}
                  >
                    Twin mode runs in <span className="font-bold">Pair</span> speaker mode.
                  </span>
                  <span
                    className={`text-xs ${
                      isLightMode ? 'text-zinc-500' : 'text-zinc-400'
                    }`}
                  >
                    Individual speaker mode is not supported in this build — the
                    underlying byte (01 00 02 06) is mapped but its speaker-routing
                    semantics are not yet reverse-engineered.
                  </span>
                </div>
              )}

              {mode === 'single' && (
                <div
                  className={`text-xs ${
                    isLightMode ? 'text-zinc-500' : 'text-zinc-400'
                  }`}
                >
                  Single mode has no additional parameters.
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
