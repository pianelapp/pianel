import {useTones} from '../../hooks/useTones';
import {summariseScene} from '../../helpers/sceneSummary';
import {sceneBadgeClass, statusBadgeClass} from '../../helpers/sceneBadge';
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

  return (
    <div className={stacked ? 'p-3.5' : 'p-5'}>
      <div
        className={`${stacked ? 'text-3xl' : 'text-5xl'} font-extrabold uppercase tracking-wider ${
          isLightMode ? 'text-cyan-700' : 'text-cyan-400'
        }`}>
        {scene.label}
      </div>

      <div className={`flex items-center gap-2 ${stacked ? 'mt-2' : 'mt-3.5'}`}>
        <span className={sceneBadgeClass(summary.modeLabel, isLightMode, true)}>
          {summary.modeLabel}
        </span>
        {isModified && (
          <span
            data-scene-modified
            className={statusBadgeClass('amber', isLightMode, true)}>
            MODIFIED
          </span>
        )}
      </div>

      <div className={stacked ? 'mt-2 space-y-0.5' : 'mt-3 space-y-1'}>
        {summary.tones.map((tone, i) => (
          <div
            key={i}
            className={`flex items-baseline gap-1.5 font-semibold ${
              stacked ? 'text-base' : 'text-xl'
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
              <span className="text-sm font-mono text-zinc-500">
                · split {summary.splitPoint}
              </span>
            )}
          </div>
        ))}
      </div>

      {scene.notes && (
        <div
          data-scene-notes
          className={`${stacked ? 'mt-2.5 text-sm' : 'mt-4 text-base'} italic ${
            isLightMode ? 'text-amber-700' : 'text-amber-400'
          }`}>
          {scene.notes}
        </div>
      )}
    </div>
  );
}
