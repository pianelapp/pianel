/**
 * PresetNamingDialog — text-input modal used for "Save preset" and
 * "Rename preset" flows. Empty / whitespace-only input is rejected with
 * inline validation (Edge Cases — *Empty name input*).
 */

import { useEffect, useState } from 'react';

interface PresetNamingDialogProps {
  title: string;
  confirmLabel: string;
  initialValue?: string;
  isLightMode: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PresetNamingDialog({
  title,
  confirmLabel,
  initialValue = '',
  isLightMode,
  onConfirm,
  onCancel,
}: PresetNamingDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Name cannot be empty.');
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-naming-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <form
        onSubmit={handleSubmit}
        className={`w-[320px] rounded-3xl p-6 shadow-2xl border ${
          isLightMode ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <h2
          id="preset-naming-title"
          className={`text-lg font-bold mb-4 ${
            isLightMode ? 'text-zinc-800' : 'text-zinc-100'
          }`}
        >
          {title}
        </h2>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={e => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Preset name"
          aria-invalid={error ? true : false}
          className={`w-full px-3 py-2 rounded-xl border text-base ${
            isLightMode
              ? 'bg-slate-50 border-zinc-200 text-zinc-800'
              : 'bg-zinc-950 border-zinc-800 text-zinc-100'
          } ${error ? 'border-red-500' : ''}`}
        />
        {error && (
          <p
            role="alert"
            className={`text-xs mt-2 ${isLightMode ? 'text-red-600' : 'text-red-400'}`}
          >
            {error}
          </p>
        )}
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className={`flex-1 text-sm font-bold tracking-widest py-2.5 rounded-xl transition-colors ${
              isLightMode
                ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`flex-1 text-sm font-bold tracking-widest py-2.5 rounded-xl transition-colors ${
              isLightMode
                ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                : 'bg-cyan-500 text-zinc-950 hover:bg-cyan-400'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
