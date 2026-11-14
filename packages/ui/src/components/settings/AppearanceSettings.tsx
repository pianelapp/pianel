import Sun from 'lucide-react/dist/esm/icons/sun';
import Moon from 'lucide-react/dist/esm/icons/moon';
import Check from 'lucide-react/dist/esm/icons/check';
import { usePreferences } from '../../hooks/usePreferences';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedCardProps<T extends string> {
  title: string;
  groupLabel: string;
  dataKey: `data-${string}`;
  options: ReadonlyArray<SegmentedOption<T>>;
  selected: T;
  onSelect: (value: T) => void;
  isLightMode: boolean;
}

function SegmentedCard<T extends string>({
  title,
  groupLabel,
  dataKey,
  options,
  selected,
  onSelect,
  isLightMode,
}: SegmentedCardProps<T>) {
  return (
    <div
      className={`p-3.5 rounded-xl border transition-colors ${
        isLightMode
          ? 'bg-slate-50 border-zinc-200'
          : 'bg-zinc-950 border-zinc-800'
      }`}>
      <span
        className={`block text-base font-medium mb-2.5 ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`}>
        {title}
      </span>
      <div
        role="group"
        aria-label={groupLabel}
        className={`flex gap-1 p-1 rounded-lg border transition-colors ${
          isLightMode
            ? 'bg-zinc-200/60 border-zinc-200'
            : 'bg-zinc-900/60 border-zinc-800/50'
        }`}>
        {options.map(({ value, label }) => {
          const isSelected = selected === value;
          return (
            <button
              key={value}
              {...{ [dataKey]: value }}
              onClick={() => onSelect(value)}
              aria-pressed={isSelected}
              className={`flex-1 min-w-0 px-2 py-1.5 rounded-md font-bold tracking-wide text-xs uppercase whitespace-nowrap transition-all ${
                isSelected
                  ? isLightMode
                    ? 'bg-white text-cyan-700 border border-cyan-200 shadow-xs'
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
  );
}

interface AppearanceSettingsProps {
  isLightMode: boolean;
}

export function AppearanceSettings({ isLightMode }: AppearanceSettingsProps) {
  const {
    themePreference,
    accidentalPreference,
    masterVolumeSide,
    setTheme,
    setAccidentals,
    setMasterVolumeSide,
  } = usePreferences();

  const isSystemTheme = themePreference === 'system';

  return (
    <div data-appearance className="space-y-3">
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
          <button
            data-theme-toggle
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
          <button
            data-theme-system
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
              {isSystemTheme && <Check className="w-3.5 h-3.5 text-white" />}
            </span>
          </button>
        </div>
      </div>

      <SegmentedCard
        title="Accidentals"
        groupLabel="Accidental spelling"
        dataKey="data-accidental"
        options={[
          { value: 'sharps', label: 'Sharps ♯' },
          { value: 'flats', label: 'Flats ♭' },
        ]}
        selected={accidentalPreference}
        onSelect={setAccidentals}
        isLightMode={isLightMode}
      />

      <SegmentedCard
        title="Volume Panel"
        groupLabel="Volume panel side"
        dataKey="data-volume-side"
        options={[
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ]}
        selected={masterVolumeSide}
        onSelect={setMasterVolumeSide}
        isLightMode={isLightMode}
      />
    </div>
  );
}
