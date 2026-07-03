import { useEffect } from 'react';
import type { Tone } from '@pianel/core/types/types';

interface ToneActionsModalProps {
  tone: Tone | null;
  open: boolean;
  isFavorite: boolean;
  isLightMode: boolean;
  onToggleFavorite: () => void;
  onSetAsDefault: () => void;
  onClose: () => void;
}

export function ToneActionsModal({
  tone,
  open,
  isFavorite,
  isLightMode,
  onToggleFavorite,
  onSetAsDefault,
  onClose,
}: ToneActionsModalProps) {
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

  if (!open || !tone) return null;

  const cardClass = isLightMode
    ? 'bg-zinc-50/95 border-zinc-200 text-zinc-800'
    : 'bg-zinc-900/95 border-zinc-800 text-zinc-200';

  const subtitleClass = isLightMode ? 'text-zinc-500' : 'text-zinc-400';

  const primaryActionClass = isLightMode
    ? 'bg-white text-zinc-800 hover:bg-zinc-100 border border-zinc-200 shadow-sm'
    : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700';

  const cancelActionClass = isLightMode
    ? 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
    : 'bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700';

  const handleToggleFavorite = () => {
    onToggleFavorite();
    onClose();
  };

  const handleSetAsDefault = () => {
    onSetAsDefault();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tone-actions-title"
      onClick={onClose}
    >
      <div
        className={`w-[380px] rounded-3xl p-5 shadow-2xl border transition-colors ${cardClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <h2
            id="tone-actions-title"
            className={`text-xl font-bold leading-tight truncate ${
              isLightMode ? 'text-zinc-900' : 'text-zinc-100'
            }`}
          >
            {tone.name}
          </h2>
          <p className={`text-sm mt-1 ${subtitleClass}`}>
            {tone.categoryName} #{tone.position + 1}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleToggleFavorite}
            autoFocus
            className={`w-full py-3 rounded-2xl text-base font-semibold transition-colors ${primaryActionClass}`}
          >
            {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          </button>

          <button
            onClick={handleSetAsDefault}
            className={`w-full py-3 rounded-2xl text-base font-semibold transition-colors ${primaryActionClass}`}
          >
            Set as Default
          </button>

          <button
            onClick={onClose}
            className={`w-full py-3 rounded-2xl text-base font-semibold transition-colors mt-1 ${cancelActionClass}`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
