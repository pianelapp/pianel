import { useEffect } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import { usePreferences } from '../../hooks/usePreferences';

interface AccidentalQuickSwitchProps {
  isLightMode: boolean;
  open: boolean;
  onClose: () => void;
}

/**
 * Quick Sharps/Flats switch opened from the Real-Time Chord Display
 * (009-settings-preferences, Req 8). Presentational and stateless beyond the
 * `open` prop: it reads the current `accidentalPreference` and writes through
 * the same `usePreferences` hook the Settings panel uses, so both surfaces
 * always reflect the same store value (Req 7.6 / 8.6). Reuses the existing
 * overlay/card/Escape/close conventions from `AlertModal` (Req 8.8 / 8.9).
 */
export function AccidentalQuickSwitch({
  isLightMode,
  open,
  onClose,
}: AccidentalQuickSwitchProps) {
  const { accidentalPreference, setAccidentals } = usePreferences();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="quick-switch-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Accidental spelling"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-[280px] rounded-3xl p-6 shadow-2xl border transition-colors ${
          isLightMode ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className={`text-lg font-bold tracking-wide ${
              isLightMode ? 'text-zinc-800' : 'text-zinc-100'
            }`}
          >
            Accidentals
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full hover:bg-zinc-500/20 transition-colors"
          >
            <X className={`w-5 h-5 ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`} />
          </button>
        </div>

        <div
          role="group"
          aria-label="Accidental spelling"
          className={`flex gap-1 p-1 rounded-lg border transition-colors ${
            isLightMode ? 'bg-zinc-200/60 border-zinc-200' : 'bg-zinc-900/60 border-zinc-800/50'
          }`}
        >
          {([
            { value: 'sharps', label: 'Sharps ♯' },
            { value: 'flats', label: 'Flats ♭' },
          ] as const).map(({ value, label }) => {
            const selected = accidentalPreference === value;
            return (
              <button
                key={value}
                onClick={() => setAccidentals(value)}
                aria-pressed={selected}
                className={`flex-1 px-2 py-2 rounded-md font-bold tracking-wide text-sm uppercase transition-all ${
                  selected
                    ? isLightMode
                      ? 'bg-white text-cyan-700 border border-cyan-200 shadow-sm'
                      : 'bg-zinc-800 text-cyan-400 border border-cyan-900/50 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                    : isLightMode
                    ? 'text-zinc-500 hover:text-zinc-700'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
