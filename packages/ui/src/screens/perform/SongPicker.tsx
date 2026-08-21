import {sceneCountLabel} from '../setlists/labels';

export interface SongPickerEntry {
  name: string;
  sceneCount: number;
  isCustomized: boolean;
}

interface SongPickerProps {
  setlistName: string;
  entries: SongPickerEntry[];
  entryIndex: number;
  sceneIndex: number;
  isLightMode: boolean;
  onJump: (index: number) => void;
  onClose: () => void;
}

export function SongPicker({
  setlistName,
  entries,
  entryIndex,
  sceneIndex,
  isLightMode,
  onJump,
  onClose,
}: SongPickerProps) {
  return (
    <div
      data-picker-scrim
      role="dialog"
      aria-modal="true"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        data-picker-panel
        className={`w-full max-w-md rounded-xl border overflow-hidden ${
          isLightMode ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-zinc-800'
        }`}>
        <div
          className={`flex items-center justify-between px-4 py-3 border-b ${
            isLightMode ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
          }`}>
          <span
            className={`truncate text-sm font-extrabold uppercase tracking-widest ${
              isLightMode ? 'text-zinc-800' : 'text-zinc-200'
            }`}>
            {setlistName}
          </span>
          <span
            className={`shrink-0 font-mono text-xs font-bold tracking-wider ${
              isLightMode ? 'text-zinc-400' : 'text-zinc-600'
            }`}>
            {entryIndex + 1} / {entries.length}
          </span>
        </div>

        <div>
          {entries.map((entry, index) => (
            <PickerRow
              key={index}
              entry={entry}
              index={index}
              entryIndex={entryIndex}
              sceneIndex={sceneIndex}
              isLightMode={isLightMode}
              onJump={onJump}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PickerRowProps {
  entry: SongPickerEntry;
  index: number;
  entryIndex: number;
  sceneIndex: number;
  isLightMode: boolean;
  onJump: (index: number) => void;
}

function PickerRow({entry, index, entryIndex, sceneIndex, isLightMode, onJump}: PickerRowProps) {
  const isPlayed = index < entryIndex;
  const isCurrent = index === entryIndex;

  return (
    <button
      type="button"
      data-entry={index}
      data-played={isPlayed ? 'true' : 'false'}
      onClick={() => onJump(index)}
      className={`tap-target w-full flex items-center gap-3 px-4 py-3.5 text-left border-b transition-colors ${
        isLightMode ? 'border-zinc-200' : 'border-zinc-800'
      } ${rowClass(isCurrent, isPlayed, isLightMode)}`}>
      <span className={`shrink-0 w-4 font-mono text-xs ${numberClass(isLightMode)}`}>
        {index + 1}
      </span>
      <span className="min-w-0 truncate">{entry.name}</span>
      <span
        className={`ml-auto shrink-0 text-xs font-medium ${metaClass(isCurrent, isLightMode)}`}>
        {metaText(entry, index, entryIndex, sceneIndex)}
        {entry.isCustomized && (
          <>
            {' · '}
            <span className="text-yellow-700">edited</span>
          </>
        )}
      </span>
    </button>
  );
}

function rowClass(isCurrent: boolean, isPlayed: boolean, isLightMode: boolean): string {
  if (isCurrent) {
    return `font-extrabold shadow-[inset_3px_0_0] ${
      isLightMode ? 'bg-cyan-50 text-cyan-700' : 'bg-cyan-950 text-cyan-400'
    }`;
  }
  if (isPlayed) {
    return `font-semibold ${isLightMode ? 'text-zinc-400' : 'text-zinc-700'}`;
  }
  return `font-semibold ${isLightMode ? 'text-zinc-700' : 'text-zinc-400'}`;
}

function numberClass(isLightMode: boolean): string {
  return isLightMode ? 'text-zinc-400' : 'text-zinc-700';
}

function metaClass(isCurrent: boolean, isLightMode: boolean): string {
  if (isCurrent) return 'text-cyan-600';
  return isLightMode ? 'text-zinc-400' : 'text-zinc-700';
}

function metaText(
  entry: SongPickerEntry,
  index: number,
  entryIndex: number,
  sceneIndex: number,
): string {
  if (index < entryIndex) return 'done';
  if (index === entryIndex) return `scene ${sceneIndex + 1} / ${entry.sceneCount}`;
  return sceneCountLabel(entry.sceneCount);
}
