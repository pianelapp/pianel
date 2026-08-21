import {useEffect, useRef} from 'react';
import {useTones} from '../../hooks/useTones';
import {summariseScene, type SceneSummary} from '../../helpers/sceneSummary';
import type {Scene} from '../../store';

interface SceneRailProps {
  scenes: Scene[];
  currentIndex: number;
  isLightMode: boolean;
  onJump: (index: number) => void;
}

export function SceneRail({scenes, currentIndex, isLightMode, onJump}: SceneRailProps) {
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
        const summary = summariseScene(scene.snapshot, id => findToneById(id)?.name);

        return (
          <button
            key={scene.id}
            type="button"
            data-scene-row
            data-current={isCurrent ? 'true' : 'false'}
            ref={isCurrent ? currentRef : undefined}
            onClick={() => onJump(index)}
            className={`tap-target w-full flex items-center gap-2.5 px-3.5 py-3 text-base border-b text-left transition-colors ${
              isLightMode ? 'border-zinc-200' : 'border-zinc-800'
            } ${rowStateClass(isCurrent, isLightMode)}`}>
            <span className={`shrink-0 w-4 font-mono text-xs ${numberClass(isCurrent, isLightMode)}`}>
              {index + 1}
            </span>
            <span className="min-w-0 truncate">{scene.label}</span>
            <span className={`ml-auto shrink-0 text-xs font-medium ${soundClass(isLightMode)}`}>
              {soundLabel(summary)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function rowStateClass(isCurrent: boolean, isLightMode: boolean): string {
  if (!isCurrent) return 'font-semibold text-zinc-500';
  return `font-extrabold shadow-[inset_3px_0_0] ${
    isLightMode ? 'bg-cyan-50 text-cyan-700' : 'bg-cyan-950 text-cyan-400'
  }`;
}

function numberClass(isCurrent: boolean, isLightMode: boolean): string {
  if (isCurrent) return 'text-cyan-600';
  return isLightMode ? 'text-zinc-400' : 'text-zinc-700';
}

function soundClass(isLightMode: boolean): string {
  return isLightMode ? 'text-zinc-400' : 'text-zinc-700';
}

function soundLabel(summary: SceneSummary): string {
  if (summary.modeLabel === 'SPLIT' || summary.modeLabel === 'DUAL') return summary.modeLabel;
  return summary.tones[0]?.name ?? '';
}
