import { useEffect } from 'react';
import type { Tone } from '@pianel/core/types/types';
import {
  ASSIGN_ACTION_DISCONNECTED_LABEL,
  ASSIGN_ACTION_LABEL,
  ASSIGNMENTS_ACTION_LABEL,
} from '../../helpers/channelAssignmentLabels';

interface ToneActionsModalProps {
  tone: Tone | null;
  open: boolean;
  isFavorite: boolean;
  isLightMode: boolean;
  onToggleFavorite: () => void;
  onSetAsDefault: () => void;
  onAssignToChannel: () => void;
  canAssignToChannel: boolean;
  onViewChannelAssignments: () => void;
  onClose: () => void;
}

export function ToneActionsModal({
  tone,
  open,
  isFavorite,
  isLightMode,
  onToggleFavorite,
  onSetAsDefault,
  onAssignToChannel,
  canAssignToChannel,
  onViewChannelAssignments,
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
    ? 'bg-white text-zinc-800 hover:bg-zinc-100 border border-zinc-200 shadow-xs'
    : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700';

  const disabledActionClass = isLightMode
    ? 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-default'
    : 'bg-zinc-800/40 text-zinc-600 border border-zinc-800 cursor-default';

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

  const handleAssignToChannel = () => {
    onAssignToChannel();
    onClose();
  };

  const handleViewChannelAssignments = () => {
    onViewChannelAssignments();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs"
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
            onClick={handleAssignToChannel}
            disabled={!canAssignToChannel}
            className={`w-full py-3 rounded-2xl text-base font-semibold transition-colors ${
              canAssignToChannel ? primaryActionClass : disabledActionClass
            }`}
          >
            {canAssignToChannel
              ? ASSIGN_ACTION_LABEL
              : ASSIGN_ACTION_DISCONNECTED_LABEL}
          </button>

          <button
            onClick={handleViewChannelAssignments}
            className={`w-full py-3 rounded-2xl text-base font-semibold transition-colors ${primaryActionClass}`}
          >
            {ASSIGNMENTS_ACTION_LABEL}
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
