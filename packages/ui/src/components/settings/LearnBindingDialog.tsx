import { useEffect, useState } from 'react';
import { canRelease } from '@pianel/core/helpers/controlMessage';
import { useControlSurface } from '../../hooks/useControlSurface';
import { behaviourLabel, describeMatch } from './bindingLabel';
import type { Behaviour } from '../../store';

interface LearnBindingDialogProps {
  isLightMode: boolean;
}

const COUNTDOWN_TICK_MS = 250;

export function LearnBindingDialog({ isLightMode }: LearnBindingDialogProps) {
  const surface = useControlSurface();
  const { learn } = surface;
  const releaseWindow =
    learn.phase === 'detecting' ? learn.releaseWindowMs : null;
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (releaseWindow === null) {
      setRemaining(null);
      return;
    }
    const startedAt = Date.now();
    const left = () => Math.max(0, releaseWindow - (Date.now() - startedAt));
    setRemaining(left());
    const id = setInterval(() => setRemaining(left()), COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, [releaseWindow]);

  if (learn.phase === 'idle') return null;

  const pressOnlySwitch =
    learn.capable.length === 1 && learn.capable[0] === 'press';

  const action = surface.actions.find(a => a.id === learn.actionId) ?? null;
  const conflictLabel =
    surface.actions.find(a => a.id === learn.conflictActionId)?.label ??
    learn.conflictActionId;

  const panelClass = isLightMode
    ? 'bg-white border-zinc-200'
    : 'bg-zinc-900 border-zinc-800';
  const titleClass = isLightMode ? 'text-zinc-700' : 'text-zinc-300';
  const bodyClass = isLightMode ? 'text-zinc-600' : 'text-zinc-400';
  const accentClass = isLightMode ? 'text-cyan-700' : 'text-cyan-400';
  const warnClass = isLightMode ? 'text-amber-700' : 'text-amber-400';

  return (
    <div
      data-hf-learn
      className={`mt-2 p-3 rounded-xl border flex flex-col gap-2 ${panelClass}`}>
      {learn.phase === 'armed' && (
        <span className={`text-sm font-medium ${titleClass}`}>
          Press the switch you want for {action?.label ?? learn.actionId}
        </span>
      )}

      {learn.phase === 'detecting' && (
        <span className={`text-sm font-medium ${titleClass}`}>
          Got {learn.captured ? describeMatch(learn.captured) : ''} — checking
          for a release
          {remaining !== null && (
            <span data-hf-countdown className={warnClass}>
              {' '}
              · {Math.ceil(remaining / 1000)}s
            </span>
          )}
        </span>
      )}

      {learn.phase === 'timeout' && (
        <span className={`text-sm font-medium ${warnClass}`}>
          No message received. Wake the pedal and try again.
        </span>
      )}

      {learn.phase === 'conflict' && (
        <span className={`text-sm font-medium ${warnClass}`}>
          {learn.captured ? describeMatch(learn.captured) : ''} is already bound
          to {conflictLabel}. Reassign it?
        </span>
      )}

      {learn.phase === 'confirming' && (
        <>
          <span className={`text-sm font-medium ${titleClass}`}>
            {learn.captured ? describeMatch(learn.captured) : ''} — how should
            it behave?
          </span>
          {pressOnlySwitch && (
            <span data-hf-press-only className={`text-xs ${warnClass}`}>
              {learn.captured && !canRelease(learn.captured)
                ? `A ${learn.captured.type === 'pc' ? 'program change' : 'SysEx'} message carries no release, so only press is available. Send CC from this switch for hold and peek.`
                : 'This switch did not report a release, so only press is available.'}
            </span>
          )}
          <div className="flex flex-col">
            {learn.behaviours.map((behaviour: Behaviour) => (
              <button
                key={behaviour}
                type="button"
                data-hf-behaviour={behaviour}
                onClick={() => surface.confirmLearn(behaviour)}
                className={`tap-target text-left text-sm ${accentClass}`}>
                {behaviourLabel(behaviour)}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        {learn.phase === 'timeout' && (
          <button
            type="button"
            data-hf-retry
            onClick={() => learn.actionId && surface.startLearn(learn.actionId)}
            className={`tap-target text-xs font-bold tracking-widest ${accentClass}`}>
            TRY AGAIN
          </button>
        )}
        {learn.phase === 'conflict' && (
          <button
            type="button"
            data-hf-reassign
            onClick={surface.acceptConflict}
            className={`tap-target text-xs font-bold tracking-widest ${accentClass}`}>
            REASSIGN
          </button>
        )}
        <button
          type="button"
          data-hf-cancel
          onClick={surface.cancelLearn}
          className={`ml-auto tap-target text-xs font-bold tracking-widest ${bodyClass}`}>
          CANCEL
        </button>
      </div>
    </div>
  );
}
