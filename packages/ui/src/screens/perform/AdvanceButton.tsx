import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import type { NextTarget } from '../../hooks/usePerformCursor';
import { sceneCountLabel } from '../setlists/labels';

interface AdvanceButtonProps {
  target: NextTarget;
  isLightMode: boolean;
  stacked: boolean;
  onAdvance: () => void;
  onPrev: () => void;
  canGoBack: boolean;
}

export function AdvanceButton({
  target,
  isLightMode,
  stacked,
  onAdvance,
  onPrev,
  canGoBack,
}: AdvanceButtonProps) {
  const height = stacked ? 'h-[78px]' : 'h-[84px]';
  const prevWidth = stacked ? 'w-[54px]' : 'w-[74px]';

  return (
    <div className={`${stacked ? 'p-3' : 'px-4 pb-4'} flex gap-2.5 shrink-0`}>
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoBack}
        className={`${prevWidth} ${height} shrink-0 flex flex-col items-center justify-center gap-1 rounded-[11px] border text-xs font-bold tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          isLightMode
            ? 'bg-zinc-100 border-zinc-200 text-zinc-400'
            : 'bg-zinc-900 border-zinc-700 text-zinc-600'
        }`}>
        <ChevronLeft className="w-5 h-5" />
        PREV
      </button>
      <button
        type="button"
        data-perform-primary
        onClick={onAdvance}
        disabled={target.kind === 'end'}
        className={`flex-1 min-w-0 ${height} flex justify-center rounded-[11px] border-2 transition-colors disabled:cursor-not-allowed ${
          stacked
            ? 'flex-col items-stretch px-4 py-2'
            : 'items-center gap-3.5'
        } ${primaryTreatment(target, isLightMode)}`}>
        {primaryContent(target, isLightMode, stacked)}
      </button>
    </div>
  );
}

function primaryTreatment(target: NextTarget, isLightMode: boolean): string {
  if (target.kind === 'song') {
    return 'bg-cyan-400 border-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.45)]';
  }
  if (target.kind === 'scene') {
    return isLightMode
      ? 'bg-cyan-50 border-cyan-200'
      : 'bg-cyan-950 border-cyan-700 shadow-[0_0_22px_rgba(34,211,238,0.22)]';
  }
  return isLightMode
    ? 'bg-zinc-100 border-zinc-200'
    : 'bg-zinc-900 border-zinc-800';
}

function primaryContent(target: NextTarget, isLightMode: boolean, stacked: boolean) {
  if (target.kind === 'end') {
    return (
      <span
        className={`${stacked ? 'text-xl' : 'text-2xl'} font-extrabold tracking-[0.04em] text-center ${
          isLightMode ? 'text-zinc-400' : 'text-zinc-700'
        }`}>
        END OF SET
      </span>
    );
  }

  const isSong = target.kind === 'song';
  const keyText = isSong ? 'NEXT SONG' : 'NEXT';
  const keyClass = isSong ? 'text-cyan-950' : 'text-cyan-600';
  const valueText = isSong ? target.song.name : target.scene.label;
  const valueClass = isSong
    ? 'text-teal-950'
    : isLightMode
      ? 'text-cyan-700'
      : 'text-cyan-400';
  const countText = isSong ? sceneCountLabel(target.song.scenes.length) : null;

  if (stacked) {
    return (
      <>
        <span
          className={`shrink-0 truncate text-xs font-extrabold tracking-[0.2em] ${keyClass}`}>
          {keyText}
          {countText ? ` · ${countText}` : ''}
        </span>
        <span
          className={`min-w-0 truncate text-xl font-extrabold tracking-[0.02em] uppercase leading-tight ${valueClass}`}>
          {valueText}
        </span>
      </>
    );
  }

  const subtitleClass = isLightMode ? 'text-cyan-600' : 'text-cyan-700';

  return (
    <>
      <span className={`shrink-0 text-xs font-extrabold tracking-[0.24em] ${keyClass}`}>
        {keyText}
      </span>
      <span className="min-w-0 flex items-baseline gap-1.5">
        <span
          className={`min-w-0 truncate text-[26px] font-extrabold tracking-[0.04em] uppercase ${valueClass}`}>
          {valueText}
        </span>
        {countText && (
          <span className={`shrink-0 text-sm font-semibold ${subtitleClass}`}>
            · {countText}
          </span>
        )}
      </span>
    </>
  );
}
