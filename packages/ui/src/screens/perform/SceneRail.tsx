import {useEffect, useRef} from 'react';
import {useTones} from '../../hooks/useTones';
import {summariseScene, type SceneSummary} from '../../helpers/sceneSummary';
import type {Scene} from '../../store';

interface SceneRailProps {
  scenes: Scene[];
  currentIndex: number;
  anchorIndex?: number | null;
  isLightMode: boolean;
  onJump: (index: number) => void;
}

export function SceneRail({
  scenes,
  currentIndex,
  anchorIndex = null,
  isLightMode,
  onJump,
}: SceneRailProps) {
  const {findToneById} = useTones();
  const currentRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const el = currentRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({block: 'center'});
    }
  }, [currentIndex]);

  return (
    <div data-scrolls className="flex-1 overflow-y-auto custom-scrollbar">
      {scenes.map((scene, index) => {
        const isCurrent = index === currentIndex;
        const isAnchor = !isCurrent && index === anchorIndex;
        const summary = summariseScene(scene.snapshot, id => findToneById(id)?.name);

        return (
          <button
            key={scene.id}
            type="button"
            data-scene-row
            data-current={isCurrent ? 'true' : 'false'}
            data-anchor-row={isAnchor ? '' : undefined}
            ref={isCurrent ? currentRef : undefined}
            onClick={() => onJump(index)}
            className={`tap-target relative w-full flex items-center gap-2.5 px-3.5 py-3 text-base border-b text-left transition-colors ${
              isLightMode ? 'border-zinc-200' : 'border-zinc-800'
            } ${rowStateClass(isCurrent, isLightMode)}`}>
            <span className={`shrink-0 w-4 font-mono text-xs ${numberClass(isCurrent, isLightMode)}`}>
              {index + 1}
            </span>
            <span className="min-w-0 truncate">{scene.label}</span>
            <span className={`ml-auto shrink-0 text-xs font-medium ${soundClass(isCurrent, isLightMode)}`}>
              {soundLabel(summary)}
            </span>
            {isAnchor && (
              <>
                <span
                  data-anchor-bar
                  aria-hidden="true"
                  className={`absolute inset-y-0 right-0 w-[3px] ${anchorBarClass(isLightMode)}`}
                />
                <span
                  className={`shrink-0 font-mono text-[10px] font-bold tracking-widest ${anchorTextClass(isLightMode)}`}>
                  HOLD
                  <span className="sr-only">, release returns here</span>
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

function rowStateClass(isCurrent: boolean, isLightMode: boolean): string {
  if (!isCurrent) return 'font-semibold text-zinc-500';
  return `font-extrabold shadow-[inset_3px_0_0] ${
    isLightMode ? 'bg-cyan-100 text-cyan-800' : 'bg-cyan-950 text-cyan-400'
  }`;
}

function anchorBarClass(isLightMode: boolean): string {
  return isLightMode ? 'bg-amber-700' : 'bg-amber-400';
}

function anchorTextClass(isLightMode: boolean): string {
  return isLightMode ? 'text-amber-700' : 'text-amber-400';
}

function numberClass(isCurrent: boolean, isLightMode: boolean): string {
  if (isCurrent) return isLightMode ? 'text-cyan-800' : 'text-cyan-600';
  return isLightMode ? 'text-zinc-500' : 'text-zinc-700';
}

function soundClass(isCurrent: boolean, isLightMode: boolean): string {
  if (!isLightMode) return 'text-zinc-700';
  return isCurrent ? 'text-zinc-600' : 'text-zinc-500';
}

function soundLabel(summary: SceneSummary): string {
  if (summary.modeLabel === 'SPLIT' || summary.modeLabel === 'DUAL') return summary.modeLabel;
  return summary.tones[0]?.name ?? '';
}
