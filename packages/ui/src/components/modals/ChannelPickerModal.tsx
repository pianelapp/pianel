import { useEffect, useRef } from 'react';
import type { Tone } from '@pianel/core/types/types';
import {
  useChannelAssignment,
  type ChannelPickerRow,
} from '../../hooks/useChannelAssignment';
import {
  CHANNEL_INELIGIBILITY_LABELS,
  channelRowLabel,
} from '../../helpers/channelAssignmentLabels';

const STALE_NOTICE =
  'The piano reconnected since these were sent — they may no longer match.';

const EXTERNAL_MIDI_HINT =
  'An assigned channel sounds only when an external MIDI device plays that channel.';

const NO_ASSIGNMENTS_YET = 'Nothing sent to a MIDI channel yet this session.';

/**
 * `assign` offers every channel and commits the chosen one. `review` lists only
 * the channels Pianel has already sent to and is read-only — the record set is
 * not tone-specific, so no tone is named.
 */
export type ChannelPickerMode = 'assign' | 'review';

interface ChannelPickerModalProps {
  tone: Tone | null;
  open: boolean;
  isLightMode: boolean;
  onClose: () => void;
  mode?: ChannelPickerMode;
}

export function ChannelPickerModal({
  tone,
  open,
  isLightMode,
  onClose,
  mode = 'assign',
}: ChannelPickerModalProps) {
  const { rows, anyStale, assign } = useChannelAssignment(open ? tone : null);
  const isReview = mode === 'review';
  const cardRef = useRef<HTMLDivElement>(null);

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

  // Read-only rows are not focusable, so the card itself takes focus — an
  // aria-modal dialog that leaves focus on the body is never announced.
  useEffect(() => {
    if (open && isReview) cardRef.current?.focus();
  }, [open, isReview]);

  if (!open || !tone) return null;

  const cardClass = isLightMode
    ? 'bg-zinc-50/95 border-zinc-200 text-zinc-800'
    : 'bg-zinc-900/95 border-zinc-800 text-zinc-200';

  const subtitleClass = isLightMode ? 'text-zinc-500' : 'text-zinc-400';
  const labelClass = isLightMode ? 'text-zinc-400' : 'text-zinc-600';
  const noticeClass = isLightMode ? 'text-amber-600' : 'text-amber-400';

  const rowBase =
    'w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-colors';
  const rowEnabledClass = isLightMode
    ? 'bg-white border-zinc-200 hover:bg-zinc-100 text-zinc-800'
    : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-100';
  const rowDisabledClass = isLightMode
    ? 'bg-zinc-100 border-zinc-200 text-zinc-400 cursor-default'
    : 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-default';
  const rowReadOnlyClass = isLightMode
    ? 'bg-white border-zinc-200 text-zinc-800'
    : 'bg-zinc-800 border-zinc-700 text-zinc-100';

  const visibleRows = isReview
    ? rows.filter(row => row.assignedToneName !== null)
    : rows;

  const firstEligibleChannel = isReview
    ? null
    : (rows.find(r => r.eligible)?.channel ?? null);

  const handleChoose = (row: ChannelPickerRow) => {
    if (!row.eligible) return;
    onClose();
    void assign(row.channel);
  };

  const rowBody = (row: ChannelPickerRow) => (
    <>
      <span className="font-mono text-sm font-bold w-12 shrink-0">
        {channelRowLabel(row.channel)}
      </span>
      <span className="min-w-0 flex-1 flex flex-col leading-tight">
        <span
          className={`text-sm truncate ${
            row.assignedToneName
              ? row.mayBeStale
                ? 'italic opacity-70'
                : ''
              : subtitleClass
          }`}
        >
          {row.assignedToneName ?? 'Not assigned'}
        </span>
        {!isReview && row.reason && (
          <span className={`text-xs mt-0.5 ${subtitleClass}`}>
            {CHANNEL_INELIGIBILITY_LABELS[row.reason]}
          </span>
        )}
      </span>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="channel-picker-title"
      onClick={onClose}
    >
      <div
        ref={cardRef}
        tabIndex={isReview ? -1 : undefined}
        className={`w-[380px] max-h-[85vh] flex flex-col rounded-3xl p-5 shadow-2xl border transition-colors outline-hidden ${cardClass}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-4 shrink-0">
          <h2
            id="channel-picker-title"
            className={`text-xl font-bold leading-tight ${
              isLightMode ? 'text-zinc-900' : 'text-zinc-100'
            }`}
          >
            {isReview ? 'MIDI channel assignments' : 'Assign to MIDI channel'}
          </h2>
          {!isReview && (
            <>
              <p
                className={`text-base font-semibold mt-1 truncate ${
                  isLightMode ? 'text-zinc-700' : 'text-zinc-300'
                }`}
              >
                {tone.name}
              </p>
              <p className={`text-sm mt-0.5 ${subtitleClass}`}>
                {tone.categoryName} #{tone.position + 1}
              </p>
            </>
          )}
        </div>

        <span
          className={`text-xs font-bold tracking-widest uppercase mb-1.5 shrink-0 ${labelClass}`}
        >
          Last sent by Pianel
        </span>

        {anyStale && (
          <p className={`text-xs mb-2 shrink-0 ${noticeClass}`}>
            {STALE_NOTICE}
          </p>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
          {isReview && visibleRows.length === 0 ? (
            <p className={`text-sm px-1 py-2 ${subtitleClass}`}>
              {NO_ASSIGNMENTS_YET}
            </p>
          ) : (
            visibleRows.map(row =>
              isReview ? (
                <div
                  key={row.channel}
                  className={`${rowBase} ${rowReadOnlyClass}`}
                >
                  {rowBody(row)}
                </div>
              ) : (
                <button
                  key={row.channel}
                  // Not the native `disabled` attribute: an ineligible row
                  // carries the only explanation the feature offers for
                  // channels 4 and 10, and a disabled button is skipped by
                  // assistive technology.
                  aria-disabled={!row.eligible}
                  autoFocus={row.channel === firstEligibleChannel}
                  onClick={() => handleChoose(row)}
                  className={`${rowBase} ${
                    row.eligible ? rowEnabledClass : rowDisabledClass
                  }`}
                >
                  {rowBody(row)}
                </button>
              ),
            )
          )}
        </div>

        <p className={`text-xs mt-3 shrink-0 ${subtitleClass}`}>
          {EXTERNAL_MIDI_HINT}
        </p>
      </div>
    </div>
  );
}
