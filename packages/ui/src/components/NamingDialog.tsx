import { useEffect, useState } from 'react';

interface NamingDialogProps {
  title: string;
  confirmLabel: string;
  initialValue?: string;
  placeholder?: string;
  multiline?: boolean;
  allowEmpty?: boolean;
  isLightMode: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function NamingDialog({
  title,
  confirmLabel,
  initialValue = '',
  placeholder = 'Name',
  multiline = false,
  allowEmpty = false,
  isLightMode,
  onConfirm,
  onCancel,
}: NamingDialogProps) {
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
    if (!trimmed && !allowEmpty) {
      setError('Name cannot be empty.');
      return;
    }
    onConfirm(trimmed);
  };

  const handleChange = (next: string) => {
    setValue(next);
    if (error) setError(null);
  };

  const fieldClassName = `w-full px-3 py-2 rounded-xl border text-base ${
    isLightMode
      ? 'bg-slate-50 border-zinc-200 text-zinc-800'
      : 'bg-zinc-950 border-zinc-800 text-zinc-100'
  } ${error ? 'border-red-500' : ''}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="naming-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <form
        onSubmit={handleSubmit}
        className={`w-[320px] rounded-3xl p-6 shadow-2xl border ${
          isLightMode ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <h2
          id="naming-dialog-title"
          className={`text-lg font-bold mb-4 ${
            isLightMode ? 'text-zinc-800' : 'text-zinc-100'
          }`}
        >
          {title}
        </h2>
        {multiline ? (
          <textarea
            autoFocus
            rows={4}
            value={value}
            onChange={e => handleChange(e.target.value)}
            placeholder={placeholder}
            aria-invalid={error ? true : false}
            className={fieldClassName}
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={value}
            onChange={e => handleChange(e.target.value)}
            placeholder={placeholder}
            aria-invalid={error ? true : false}
            className={fieldClassName}
          />
        )}
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
