import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import { useSetlists } from '../../hooks/useSetlists';
import { useSongs } from '../../hooks/useSongs';
import { usePresets } from '../../hooks/usePresets';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { showAlert } from '../../components/modals/AlertModal';
import { NamingDialog } from '../../components/NamingDialog';
import { EntryRow, type EntryAction } from './EntryRow';
import type { SceneAction } from './SceneRow';
import { LibraryEditDialog, type LibraryEditChoice } from './LibraryEditDialog';
import { sceneCountLabel } from './labels';
import { saveSceneAsPad } from './padBridge';
import { confirmRecapture } from './recaptureGuard';
import {
  readLibraryEditPreference,
  writeLibraryEditPreference,
} from './libraryEditPreference';
import { patchScene, moveSceneInSong, removeScene } from '@pianel/core/helpers/songEdits';
import type { Scene, Setlist, Song } from '../../store';

interface SetlistDetailProps {
  setlist: Setlist;
  isLightMode: boolean;
  onPerform: (setlistId: string) => void;
}

type SceneDialogState =
  | { kind: 'closed' }
  | { kind: 'rename'; entryIndex: number; scene: Scene }
  | { kind: 'notes'; entryIndex: number; scene: Scene };

type LibraryEditDialogState =
  | { kind: 'closed' }
  | { kind: 'open'; songName: string; actionLabel: string; followedElsewhere: boolean };

interface AddSongDialogProps {
  songs: Song[];
  isLightMode: boolean;
  onSelect: (songId: string) => void;
  onCancel: () => void;
}

function AddSongDialog({ songs, isLightMode, onSelect, onCancel }: AddSongDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-song-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        className={`w-[320px] max-h-[70vh] rounded-3xl p-6 shadow-2xl border flex flex-col ${
          isLightMode ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <h2
          id="add-song-dialog-title"
          className={`text-lg font-bold mb-4 shrink-0 ${
            isLightMode ? 'text-zinc-800' : 'text-zinc-100'
          }`}
        >
          Add Song
        </h2>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar -mx-2 px-2">
          {songs.length === 0 ? (
            <div
              className={`text-sm text-center py-6 ${
                isLightMode ? 'text-zinc-400' : 'text-zinc-600'
              }`}
            >
              Your library has no songs yet.
            </div>
          ) : (
            songs.map(song => (
              <button
                key={song.id}
                onClick={() => onSelect(song.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                  isLightMode
                    ? 'text-zinc-700 hover:bg-zinc-100'
                    : 'text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <div className="text-sm font-semibold truncate">{song.name}</div>
                <div
                  className={`text-xs font-mono mt-0.5 ${
                    isLightMode ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  {sceneCountLabel(song.scenes.length)}
                </div>
              </button>
            ))
          )}
        </div>
        <button
          onClick={onCancel}
          className={`mt-4 shrink-0 text-sm font-bold tracking-widest py-2.5 rounded-xl transition-colors ${
            isLightMode
              ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SetlistDetail({
  setlist,
  isLightMode,
  onPerform,
}: SetlistDetailProps) {
  const {
    resolveEntry,
    addSong,
    removeEntry,
    moveEntry,
    isCustomized,
    customizeEntry,
    revertEntry,
    promoteEntry,
    countSetlistsUsing,
    findLibraryUses,
    editOverride,
  } = useSetlists();
  const { songs, editSong } = useSongs();
  const { presets, captureSnapshot, applySnapshot, savePresetToTile } = usePresets();
  const { viewport } = useBreakpoint();
  const compact = viewport === 'mobile';
  const [addOpen, setAddOpen] = useState(false);
  const [sceneDialog, setSceneDialog] = useState<SceneDialogState>({ kind: 'closed' });
  const [libraryEditDialog, setLibraryEditDialog] = useState<LibraryEditDialogState>({
    kind: 'closed',
  });
  const libraryEditResolveRef = useRef<((choice: LibraryEditChoice) => void) | null>(null);

  const resolved = useMemo(
    () => setlist.entries.map((_, index) => resolveEntry(setlist.id, index)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setlist, resolveEntry, songs],
  );

  const canPerform = useMemo(
    () => resolved.some(song => (song?.scenes.length ?? 0) > 0),
    [resolved],
  );

  const totalScenes = useMemo(
    () => resolved.reduce((sum, song) => sum + (song?.scenes.length ?? 0), 0),
    [resolved],
  );

  const handleAddSong = useCallback(
    (songId: string) => {
      addSong(setlist.id, songId);
      setAddOpen(false);
    },
    [addSong, setlist.id],
  );

  const askLibraryEdit = useCallback(
    (
      songName: string,
      actionLabel: string,
      followedElsewhere: boolean,
    ): Promise<LibraryEditChoice> =>
      new Promise(resolve => {
        libraryEditResolveRef.current = resolve;
        setLibraryEditDialog({ kind: 'open', songName, actionLabel, followedElsewhere });
      }),
    [],
  );

  const handleLibraryEditChoice = useCallback(
    (choice: LibraryEditChoice, remember: boolean) => {
      const resolve = libraryEditResolveRef.current;
      libraryEditResolveRef.current = null;
      setLibraryEditDialog({ kind: 'closed' });
      if (remember && choice !== 'cancel') writeLibraryEditPreference(choice);
      resolve?.(choice);
    },
    [],
  );

  const editEntrySong = useCallback(
    async (
      entryIndex: number,
      actionLabel: string,
      transform: (song: Song) => Song,
    ): Promise<void> => {
      if (isCustomized(setlist.id, entryIndex)) {
        editOverride(setlist.id, entryIndex, transform);
        return;
      }
      const songId = setlist.entries[entryIndex]?.songId;
      if (!songId) return;

      const followedElsewhere = findLibraryUses(songId).some(
        use => !(use.setlistId === setlist.id && use.entryIndex === entryIndex),
      );

      const songName = resolved[entryIndex]?.name ?? 'this song';
      const choice =
        readLibraryEditPreference() ??
        (await askLibraryEdit(songName, actionLabel, followedElsewhere));
      if (choice === 'cancel') return;
      if (choice === 'thisGig') {
        customizeEntry(setlist.id, entryIndex);
        editOverride(setlist.id, entryIndex, transform);
        return;
      }
      editSong(songId, transform);
    },
    [
      setlist,
      isCustomized,
      editOverride,
      customizeEntry,
      findLibraryUses,
      editSong,
      askLibraryEdit,
      resolved,
    ],
  );

  const handleSceneAction = useCallback(
    async (entryIndex: number, action: SceneAction, scene: Scene, sceneIndex: number) => {
      switch (action) {
        case 'rename':
          setSceneDialog({ kind: 'rename', entryIndex, scene });
          break;
        case 'notes':
          setSceneDialog({ kind: 'notes', entryIndex, scene });
          break;
        case 'recapture': {
          if (!(await confirmRecapture(scene.label))) break;
          const snapshot = captureSnapshot();
          if (!snapshot) break;
          await editEntrySong(entryIndex, 'Re-capturing this scene', song =>
            patchScene(song, scene.id, s => ({ ...s, snapshot })),
          );
          break;
        }
        case 'moveUp':
          await editEntrySong(entryIndex, 'Reordering this scene', song =>
            moveSceneInSong(song, sceneIndex, sceneIndex - 1),
          );
          break;
        case 'moveDown':
          await editEntrySong(entryIndex, 'Reordering this scene', song =>
            moveSceneInSong(song, sceneIndex, sceneIndex + 1),
          );
          break;
        case 'delete': {
          const confirmed = await showAlert({
            variant: 'warning',
            title: 'Delete scene?',
            message: `Delete "${scene.label}"? This cannot be undone.`,
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
          });
          if (confirmed) {
            await editEntrySong(entryIndex, 'Deleting this scene', song =>
              removeScene(song, scene.id),
            );
          }
          break;
        }
        case 'saveAsPad':
          await saveSceneAsPad(scene, presets, applySnapshot, savePresetToTile).catch(() => {});
          break;
        default:
          break;
      }
    },
    [editEntrySong, captureSnapshot, presets, applySnapshot, savePresetToTile],
  );

  const handleRenameScene = useCallback(
    (label: string) => {
      if (sceneDialog.kind !== 'rename') return;
      const { entryIndex, scene } = sceneDialog;
      setSceneDialog({ kind: 'closed' });
      editEntrySong(entryIndex, 'Renaming this scene', song =>
        patchScene(song, scene.id, s => ({ ...s, label })),
      ).catch(() => {});
    },
    [sceneDialog, editEntrySong],
  );

  const handleSaveNotes = useCallback(
    (notes: string) => {
      if (sceneDialog.kind !== 'notes') return;
      const { entryIndex, scene } = sceneDialog;
      setSceneDialog({ kind: 'closed' });
      editEntrySong(entryIndex, "Editing this scene's notes", song =>
        patchScene(song, scene.id, s => ({ ...s, notes })),
      ).catch(() => {});
    },
    [sceneDialog, editEntrySong],
  );

  const handleEntryAction = useCallback(
    async (action: EntryAction, index: number) => {
      switch (action) {
        case 'moveUp':
          moveEntry(setlist.id, index, index - 1);
          break;
        case 'moveDown':
          moveEntry(setlist.id, index, index + 1);
          break;
        case 'remove':
          removeEntry(setlist.id, index);
          break;
        case 'customize':
          customizeEntry(setlist.id, index);
          break;
        case 'revert': {
          const songName = resolved[index]?.name ?? 'this song';
          const confirmed = await showAlert({
            variant: 'warning',
            title: 'Revert to library version?',
            message: `This discards the gig-only edits to "${songName}" and follows the library version again.`,
            confirmLabel: 'Revert',
            cancelLabel: 'Cancel',
          });
          if (confirmed) revertEntry(setlist.id, index);
          break;
        }
        case 'promote': {
          const songName = resolved[index]?.name ?? 'this song';
          const songId = setlist.entries[index]?.songId;
          const otherCount = songId ? countSetlistsUsing(songId) : 0;
          const confirmed = await showAlert({
            variant: 'warning',
            title: 'Push changes to library?',
            message:
              otherCount > 0
                ? `This overwrites "${songName}" in your library and affects ${otherCount} other setlist${
                    otherCount === 1 ? '' : 's'
                  } still following it.`
                : `This overwrites "${songName}" in your library.`,
            confirmLabel: 'Push',
            cancelLabel: 'Cancel',
          });
          if (confirmed) promoteEntry(setlist.id, index);
          break;
        }
        default:
          break;
      }
    },
    [
      setlist.id,
      setlist.entries,
      resolved,
      moveEntry,
      removeEntry,
      customizeEntry,
      revertEntry,
      promoteEntry,
      countSetlistsUsing,
    ],
  );

  return (
    <div className="flex flex-col h-full">
      <div
        className={`px-4 py-4 border-b shrink-0 ${
          isLightMode ? 'border-zinc-200' : 'border-zinc-800'
        }`}
      >
        <div
          className={`text-base font-bold truncate ${
            isLightMode ? 'text-zinc-800' : 'text-zinc-100'
          }`}
        >
          {setlist.name}
        </div>
        <div className="text-xs mt-0.5 text-zinc-500">
          {setlist.entries.length} song{setlist.entries.length === 1 ? '' : 's'}
          {setlist.entries.length > 0 ? ` · ${sceneCountLabel(totalScenes)}` : ''}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onPerform(setlist.id)}
            disabled={!canPerform}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              isLightMode
                ? 'bg-white text-cyan-700 border border-cyan-200 shadow-sm'
                : 'bg-zinc-800 text-cyan-400 border border-cyan-900/50'
            }`}
          >
            PERFORM
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              isLightMode
                ? 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Song
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {setlist.entries.length === 0 ? (
          <div
            className={`text-center py-12 ${
              isLightMode ? 'text-zinc-400' : 'text-zinc-600'
            }`}
          >
            <div className="text-sm font-mono mb-2">
              No songs in this setlist
            </div>
            <div className="text-xs">Add songs from your library.</div>
          </div>
        ) : (
          setlist.entries.map((entry, index) => {
            const song = resolved[index];
            const customized = isCustomized(setlist.id, index);
            return (
              <EntryRow
                key={`${entry.songId}-${index}`}
                resolved={song}
                index={index}
                total={setlist.entries.length}
                isLightMode={isLightMode}
                compact={compact}
                customized={customized}
                libraryMissing={!songs.some(s => s.id === entry.songId)}
                sharedCount={song && !customized ? countSetlistsUsing(song.id) : 0}
                onAction={handleEntryAction}
                onSceneAction={handleSceneAction}
              />
            );
          })
        )}
      </div>
      {addOpen && (
        <AddSongDialog
          songs={songs}
          isLightMode={isLightMode}
          onSelect={handleAddSong}
          onCancel={() => setAddOpen(false)}
        />
      )}
      {sceneDialog.kind === 'rename' && (
        <NamingDialog
          title="Rename scene"
          confirmLabel="Save"
          initialValue={sceneDialog.scene.label}
          placeholder="Scene name"
          isLightMode={isLightMode}
          onConfirm={handleRenameScene}
          onCancel={() => setSceneDialog({ kind: 'closed' })}
        />
      )}
      {sceneDialog.kind === 'notes' && (
        <NamingDialog
          title="Scene notes"
          confirmLabel="Save"
          initialValue={sceneDialog.scene.notes}
          placeholder="Notes"
          multiline
          allowEmpty
          isLightMode={isLightMode}
          onConfirm={handleSaveNotes}
          onCancel={() => setSceneDialog({ kind: 'closed' })}
        />
      )}
      {libraryEditDialog.kind === 'open' && (
        <LibraryEditDialog
          songName={libraryEditDialog.songName}
          setlistName={setlist.name}
          actionLabel={libraryEditDialog.actionLabel}
          followedElsewhere={libraryEditDialog.followedElsewhere}
          isLightMode={isLightMode}
          onChoose={handleLibraryEditChoice}
        />
      )}
    </div>
  );
}
