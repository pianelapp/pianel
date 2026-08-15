import Circle from 'lucide-react/dist/esm/icons/circle';
import type { Song } from '../../store';
import { sceneCountLabel } from '../setlists/labels';

interface CaptureBarProps {
  song: Song;
  isLightMode: boolean;
  compact: boolean;
  onCapture: () => void;
  onDone: () => void;
}

export function CaptureBar({
  song,
  isLightMode,
  compact,
  onCapture,
  onDone,
}: CaptureBarProps) {
  return (
    <div
      role="status"
      className={`w-full shrink-0 flex items-center gap-3 border-b transition-colors ${
        compact ? 'px-3 py-2' : 'px-8 py-2.5'
      } ${
        isLightMode
          ? 'bg-amber-50 border-amber-200'
          : 'bg-amber-950/40 border-amber-900/60'
      }`}>
      <Circle
        className={`w-2.5 h-2.5 shrink-0 fill-current ${
          isLightMode ? 'text-amber-600' : 'text-amber-400'
        }`}
        aria-hidden
      />
      <div className="min-w-0 flex-1 flex items-baseline gap-2">
        <span
          className={`text-xs font-bold tracking-widest shrink-0 ${
            isLightMode ? 'text-amber-700' : 'text-amber-400'
          }`}>
          BUILDING
        </span>
        <span
          className={`truncate text-sm font-bold ${
            isLightMode ? 'text-zinc-800' : 'text-zinc-100'
          }`}>
          {song.name}
        </span>
        <span
          className={`shrink-0 text-xs ${
            isLightMode ? 'text-zinc-500' : 'text-zinc-500'
          }`}>
          {sceneCountLabel(song.scenes.length)}
        </span>
      </div>
      <button
        type="button"
        onClick={onCapture}
        className={`tap-target shrink-0 px-4 rounded-lg text-xs font-bold tracking-widest transition-colors ${
          isLightMode
            ? 'bg-amber-600 text-white hover:bg-amber-700'
            : 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
        }`}>
        {compact ? 'CAPTURE' : 'CAPTURE SCENE'}
      </button>
      <button
        type="button"
        onClick={onDone}
        className={`tap-target shrink-0 px-3 rounded-lg text-xs font-bold tracking-widest transition-colors ${
          isLightMode
            ? 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
            : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
        }`}>
        DONE
      </button>
    </div>
  );
}
