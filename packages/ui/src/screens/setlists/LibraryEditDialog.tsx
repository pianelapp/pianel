import { useEffect } from 'react';
import X from 'lucide-react/dist/esm/icons/x';

export type LibraryEditChoice = 'everywhere' | 'thisGig' | 'cancel';

interface LibraryEditDialogProps {
  songName: string;
  setlistName: string;
  actionLabel: string;
  followedElsewhere: boolean;
  isLightMode: boolean;
  onChoose: (choice: LibraryEditChoice) => void;
}

export function LibraryEditDialog({
  songName,
  setlistName,
  actionLabel,
  followedElsewhere,
  isLightMode,
  onChoose,
}: LibraryEditDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChoose('cancel');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onChoose]);

  return (
    <div
      data-dialog-scrim
      onClick={e => {
        if (e.target === e.currentTarget) onChoose('cancel');
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-edit-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        data-dialog-panel
        className={`w-[360px] rounded-3xl p-6 shadow-2xl border ${
          isLightMode ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <h2
            id="library-edit-dialog-title"
            className={`text-lg font-bold ${
              isLightMode ? 'text-zinc-800' : 'text-zinc-100'
            }`}
          >
            Change this everywhere?
          </h2>
          <button
            data-dialog-close
            onClick={() => onChoose('cancel')}
            aria-label="Close"
            className="p-1.5 rounded-full hover:bg-zinc-500/20 transition-colors shrink-0"
          >
            <X className={`w-4 h-4 ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`} />
          </button>
        </div>
        <p
          className={`text-sm leading-relaxed mb-5 ${
            isLightMode ? 'text-zinc-600' : 'text-zinc-400'
          }`}
        >
          {actionLabel} in "{songName}"{' '}
          {followedElsewhere
            ? 'changes it in every setlist that follows it'
            : 'changes the song in your library'}
          , not just {setlistName}.
        </p>
        <div className="flex gap-2">
          <button
            data-dialog-action="everywhere"
            onClick={() => onChoose('everywhere')}
            className={`flex-1 text-sm font-bold tracking-widest py-2.5 rounded-xl transition-colors ${
              isLightMode
                ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            Update everywhere
          </button>
          <button
            data-dialog-action="thisGig"
            onClick={() => onChoose('thisGig')}
            autoFocus
            className={`flex-1 text-sm font-bold tracking-widest py-2.5 rounded-xl transition-colors ${
              isLightMode
                ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                : 'bg-cyan-500 text-zinc-950 hover:bg-cyan-400'
            }`}
          >
            Only {setlistName}
          </button>
        </div>
      </div>
    </div>
  );
}
