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
  const height = stacked ? 'h-[66px]' : 'h-[84px]';
  const prevWidth = stacked ? 'w-[54px]' : 'w-[74px]';

  return (
    <div className={`${stacked ? 'p-3' : 'px-4 pb-4'} flex gap-2.5 shrink-0`}>
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoBack}
        className={`${prevWidth} ${height} shrink-0 flex flex-col items-center justify-center gap-1 rounded-[11px] border text-[10px] font-bold tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
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
        className={`flex-1 min-w-0 ${height} flex items-center justify-center gap-3.5 rounded-[11px] border-2 transition-colors disabled:cursor-not-allowed ${primaryTreatment(target, isLightMode)}`}>
        {primaryContent(target, isLightMode)}
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

function primaryContent(target: NextTarget, isLightMode: boolean) {
  if (target.kind === 'end') {
    return (
      <span
        className={`text-[20px] font-extrabold tracking-[0.04em] ${
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
  const subtitleClass = isLightMode ? 'text-cyan-600' : 'text-cyan-700';

  return (
    <>
      <span className={`shrink-0 text-[11px] font-extrabold tracking-[0.24em] ${keyClass}`}>
        {keyText}
      </span>
      <span className="min-w-0 flex items-baseline gap-1.5">
        <span
          className={`min-w-0 truncate text-[26px] font-extrabold tracking-[0.04em] uppercase ${valueClass}`}>
          {valueText}
        </span>
        {isSong && (
          <span className={`shrink-0 text-[12px] font-semibold ${subtitleClass}`}>
            · {sceneCountLabel(target.song.scenes.length)}
          </span>
        )}
      </span>
    </>
  );
}
