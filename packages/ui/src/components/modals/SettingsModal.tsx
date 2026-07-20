import X from 'lucide-react/dist/esm/icons/x';
import Sun from 'lucide-react/dist/esm/icons/sun';
import Moon from 'lucide-react/dist/esm/icons/moon';
import Check from 'lucide-react/dist/esm/icons/check';
import { usePreferences } from '../../hooks/usePreferences';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  isLightMode: boolean;
}

export function SettingsModal({
  open,
  onClose,
  isLightMode,
}: SettingsModalProps) {
  const { themePreference, accidentalPreference, setTheme, setAccidentals } =
    usePreferences();

  // When following the OS, the manual day/night switch is shown but disabled.
  const isSystemTheme = themePreference === 'system';

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className={`p-6 rounded-3xl w-[360px] max-w-[calc(100vw-2rem)] shadow-2xl border transition-colors ${
          isLightMode
            ? 'bg-white border-zinc-200'
            : 'bg-zinc-900 border-zinc-800'
        }`}>
        <div className="flex justify-between items-center mb-6">
          <h2
            className={`text-xl font-bold tracking-wide ${isLightMode ? 'text-zinc-800' : 'text-zinc-100'}`}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-500/20 transition-colors">
            <X
              className={`w-6 h-6 ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`}
            />
          </button>
        </div>
        <div className="space-y-3">
          {/* UI Theme — day/night slide toggle + System checkbox (Task 5.1) */}
          <div
            className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
              isLightMode
                ? 'bg-slate-50 border-zinc-200'
                : 'bg-zinc-950 border-zinc-800'
            }`}>
            <span
              className={`text-base font-medium whitespace-nowrap ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`}>
              UI Theme
            </span>
            <div className="flex items-center gap-4">
              {/* Day/night slide toggle — disabled while following the OS */}
              <button
                onClick={() => setTheme(isLightMode ? 'dark' : 'light')}
                disabled={isSystemTheme}
                aria-label="Toggle light or dark theme"
                aria-pressed={!isLightMode}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all ${
                  isLightMode ? 'bg-zinc-300' : 'bg-zinc-700'
                } ${isSystemTheme ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <span
                  className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full transition-transform ${
                    isLightMode
                      ? 'translate-x-1 bg-white'
                      : 'translate-x-6 bg-zinc-900'
                  }`}>
                  {isLightMode ? (
                    <Sun className="w-3.5 h-3.5 text-orange-500" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                </span>
              </button>
              {/* System checkbox — follow the OS color scheme */}
              <button
                role="checkbox"
                aria-checked={isSystemTheme}
                onClick={() =>
                  setTheme(
                    isSystemTheme ? (isLightMode ? 'light' : 'dark') : 'system',
                  )
                }
                className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  System
                </span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                    isSystemTheme
                      ? 'bg-cyan-500 border-cyan-500'
                      : isLightMode
                        ? 'bg-white border-zinc-300'
                        : 'bg-zinc-800 border-zinc-600'
                  }`}>
                  {isSystemTheme && (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Accidentals — 2-way Sharps / Flats (Task 5.2) */}
          <div
            className={`p-3.5 rounded-xl border transition-colors ${
              isLightMode
                ? 'bg-slate-50 border-zinc-200'
                : 'bg-zinc-950 border-zinc-800'
            }`}>
            <span
              className={`block text-base font-medium mb-2.5 ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`}>
              Accidentals
            </span>
            <div
              role="group"
              aria-label="Accidental spelling"
              className={`flex gap-1 p-1 rounded-lg border transition-colors ${
                isLightMode
                  ? 'bg-zinc-200/60 border-zinc-200'
                  : 'bg-zinc-900/60 border-zinc-800/50'
              }`}>
              {(
                [
                  { value: 'sharps', label: 'Sharps ♯' },
                  { value: 'flats', label: 'Flats ♭' },
                ] as const
              ).map(({ value, label }) => {
                const selected = accidentalPreference === value;
                return (
                  <button
                    key={value}
                    onClick={() => setAccidentals(value)}
                    aria-pressed={selected}
                    className={`flex-1 min-w-0 px-2 py-1.5 rounded-md font-bold tracking-wide text-xs uppercase whitespace-nowrap transition-all ${
                      selected
                        ? isLightMode
                          ? 'bg-white text-cyan-700 border border-cyan-200 shadow-sm'
                          : 'bg-zinc-800 text-cyan-400 border border-cyan-900/50 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                        : isLightMode
                          ? 'text-zinc-500 hover:text-zinc-700'
                          : 'text-zinc-500 hover:text-zinc-300'
                    }`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
