import React, { useCallback, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import X from 'lucide-react/dist/esm/icons/x';
import { usePiano } from '../../hooks/usePiano';

const BPM_MIN = 20;
const BPM_MAX = 250;
const DELTAS = [-10, -5, -1, 1, 5, 10] as const;

interface TempoModalProps {
  open: boolean;
  onClose: () => void;
  isLightMode: boolean;
}

const clampBpm = (bpm: number): number =>
  Math.max(BPM_MIN, Math.min(BPM_MAX, bpm));

export function TempoModal({ open, onClose, isLightMode }: TempoModalProps) {
  const { tempo, changeTempo } = usePiano();
  const [directInput, setDirectInput] = useState('');

  useEffect(() => {
    if (!open) setDirectInput('');
  }, [open]);

  const handleDelta = useCallback(
    (delta: number) => {
      changeTempo(clampBpm(tempo + delta));
    },
    [tempo, changeTempo],
  );

  const handleDirectSubmit = useCallback(() => {
    const parsed = parseInt(directInput, 10);
    if (!isNaN(parsed)) {
      changeTempo(clampBpm(parsed));
    }
    setDirectInput('');
  }, [directInput, changeTempo]);

  const overlayClass = isLightMode
    ? 'bg-black/30 backdrop-blur-sm'
    : 'bg-black/60 backdrop-blur-sm';

  const contentClass = isLightMode
    ? 'bg-white/95 border-zinc-200 text-zinc-800'
    : 'bg-zinc-900/95 border-zinc-800 text-zinc-200';

  const dividerClass = isLightMode ? 'border-zinc-200' : 'border-zinc-800';
  const headerBgClass = isLightMode ? 'bg-zinc-50/80' : 'bg-zinc-950/80';

  const deltaButtonClass = isLightMode
    ? 'border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700'
    : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-zinc-200';

  const inputClass = isLightMode
    ? 'bg-white border-zinc-200 text-zinc-800 placeholder:text-zinc-400'
    : 'bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600';

  const setButtonClass = isLightMode
    ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200';

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 z-50 flex items-center justify-center ${overlayClass}`}>
          <Dialog.Content
            className={`relative w-[440px] max-w-[92vw] rounded-2xl shadow-2xl border flex flex-col overflow-hidden transition-colors ${contentClass}`}
            aria-label="Tempo Picker"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className={`flex items-center justify-between px-6 py-5 border-b shrink-0 ${headerBgClass} ${dividerClass}`}>
              <Dialog.Title className={`text-sm font-bold tracking-widest uppercase ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`}>
                Tempo
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

            <div className="px-6 py-6 flex flex-col items-center">
              <div className="flex flex-col items-center mb-5">
                <span
                  className={`font-mono tabular-nums leading-none ${isLightMode ? 'text-zinc-800' : 'text-zinc-100'}`}
                  style={{ fontSize: '64px' }}
                >
                  {tempo}
                </span>
                <span className={`text-xs font-bold tracking-widest mt-2 ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  BPM
                </span>
              </div>

              <div className="grid grid-cols-6 gap-2 w-full mb-5">
                {DELTAS.map((delta) => (
                  <button
                    key={delta}
                    onClick={() => handleDelta(delta)}
                    className={`py-2.5 rounded-lg border font-mono text-sm tabular-nums transition-colors ${deltaButtonClass}`}
                  >
                    {delta > 0 ? `+${delta}` : `${delta}`}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 w-full">
                <input
                  type="number"
                  inputMode="numeric"
                  min={BPM_MIN}
                  max={BPM_MAX}
                  value={directInput}
                  onChange={(e) => setDirectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleDirectSubmit();
                    }
                  }}
                  placeholder={`${BPM_MIN}-${BPM_MAX}`}
                  className={`flex-1 font-mono text-lg tabular-nums text-center rounded-lg border px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${inputClass}`}
                />
                <button
                  onClick={handleDirectSubmit}
                  className={`px-4 py-2 rounded-lg text-xs font-bold tracking-widest transition-colors ${setButtonClass}`}
                >
                  SET
                </button>
              </div>

              <span className={`text-[10px] font-mono tracking-wider mt-3 ${isLightMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                RANGE: {BPM_MIN} – {BPM_MAX}
              </span>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
