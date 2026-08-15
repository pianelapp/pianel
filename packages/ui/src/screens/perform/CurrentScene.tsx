import {useTones} from '../../hooks/useTones';
import {summariseScene} from '../../helpers/sceneSummary';
import {sceneBadgeClass} from '../../helpers/sceneBadge';
import type {Scene} from '../../store';

interface CurrentSceneProps {
  scene: Scene;
  isLightMode: boolean;
  stacked: boolean;
  isModified: boolean;
}

export function CurrentScene({
  scene,
  isLightMode,
  stacked,
  isModified,
}: CurrentSceneProps) {
  const {findToneById} = useTones();
  const summary = summariseScene(scene.snapshot, id => findToneById(id)?.name);

  const modifiedClass = `text-[10px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded border ${
    isLightMode
      ? 'text-amber-600 border-amber-200 bg-amber-50'
      : 'text-amber-400 border-amber-900/50 bg-amber-950/40'
  }`;

  return (
    <div className={stacked ? 'p-3.5' : 'p-5'}>
      <div
        className={`${stacked ? 'text-2xl' : 'text-4xl'} font-extrabold uppercase tracking-wider ${
          isLightMode ? 'text-cyan-700' : 'text-cyan-400'
        }`}>
        {scene.label}
      </div>

      <div className={`flex items-center gap-2 ${stacked ? 'mt-2' : 'mt-3.5'}`}>
        <span className={sceneBadgeClass(summary.modeLabel, isLightMode)}>
          {summary.modeLabel}
        </span>
        {isModified && (
          <span data-scene-modified className={modifiedClass}>
            MODIFIED
          </span>
        )}
      </div>

      <div className={stacked ? 'mt-2 space-y-0.5' : 'mt-3 space-y-1'}>
        {summary.tones.map((tone, i) => (
          <div
            key={i}
            className={`flex items-baseline gap-1.5 font-semibold ${
              stacked ? 'text-sm' : 'text-lg'
            } ${isLightMode ? 'text-zinc-800' : 'text-zinc-200'}`}>
            {tone.glyph && (
              <span
                className={`font-mono font-bold ${
                  isLightMode ? 'text-zinc-400' : 'text-zinc-600'
                }`}>
                {tone.glyph}
              </span>
            )}
            <span>{tone.name}</span>
            {tone.role === 'lower' && summary.splitPoint && (
              <span className="text-xs font-mono text-zinc-500">
                · split {summary.splitPoint}
              </span>
            )}
          </div>
        ))}
      </div>

      {scene.notes && (
        <div
          data-scene-notes
          className={`${stacked ? 'mt-2.5 text-xs' : 'mt-4 text-sm'} italic ${
            isLightMode ? 'text-amber-700' : 'text-amber-400'
          }`}>
          {scene.notes}
        </div>
      )}
    </div>
  );
}
