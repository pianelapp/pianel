import { useCallback, useState } from 'react';
import type { Song, Scene } from '../../store';
import { sceneCountLabel } from './labels';
import { SceneRow, type SceneAction } from './SceneRow';
import { NamingDialog } from '../../components/NamingDialog';
import { showAlert } from '../../components/modals/AlertModal';
import { useSongs } from '../../hooks/useSongs';
import { useSetlists } from '../../hooks/useSetlists';
import { usePresets } from '../../hooks/usePresets';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { confirmArmForCapture } from './armGuard';
import { saveSceneAsPad } from './padBridge';

interface SongDetailProps {
  song: Song;
  isLightMode: boolean;
  isArmed: boolean;
  onArm: (songId: string | null) => void;
  onPerform: (songId: string) => void;
}

type SceneDialogState =
  | { kind: 'closed' }
  | { kind: 'rename'; scene: Scene }
  | { kind: 'notes'; scene: Scene };

export function SongDetail({
  song,
  isLightMode,
  isArmed,
  onArm,
  onPerform,
}: SongDetailProps) {
  const { renameScene, setSceneNotes, recaptureScene, moveScene, deleteScene } =
    useSongs();
  const { setlists, findLibraryUses, countSetlistsUsing } = useSetlists();
  const { presets, applySnapshot, savePresetToTile } = usePresets();
  const { viewport } = useBreakpoint();
  const compact = viewport === 'mobile';
  const [dialog, setDialog] = useState<SceneDialogState>({ kind: 'closed' });

  const nameOfSetlist = useCallback(
    (setlistId: string): string =>
      setlists.find(s => s.id === setlistId)?.name ?? 'Unknown setlist',
    [setlists],
  );

  const runLibraryEdit = useCallback(
    async (actionLabel: string, apply: () => void): Promise<void> => {
      const uses = findLibraryUses(song.id);
      if (uses.length === 0) {
        apply();
        return;
      }
      const names = [...new Set(uses.map(u => nameOfSetlist(u.setlistId)))];
      const proceed = await showAlert({
        variant: 'warning',
        title:
          names.length === 1
            ? '1 setlist follows this song'
            : `${names.length} setlists follow this song`,
        message: `${actionLabel} also changes ${names.join(', ')}. To change only one gig, edit the song from inside that setlist instead.`,
        confirmLabel: 'Update',
        cancelLabel: 'Cancel',
      });
      if (proceed) apply();
    },
    [song.id, findLibraryUses, nameOfSetlist],
  );

  const handleSceneAction = useCallback(
    async (action: SceneAction, scene: Scene, index: number) => {
      switch (action) {
        case 'rename':
          setDialog({ kind: 'rename', scene });
          break;
        case 'notes':
          setDialog({ kind: 'notes', scene });
          break;
        case 'recapture':
          await runLibraryEdit('Re-capturing this scene', () =>
            recaptureScene(song.id, scene.id),
          );
          break;
        case 'moveUp':
          await runLibraryEdit('Reordering this scene', () =>
            moveScene(song.id, index, index - 1),
          );
          break;
        case 'moveDown':
          await runLibraryEdit('Reordering this scene', () =>
            moveScene(song.id, index, index + 1),
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
            await runLibraryEdit('Deleting this scene', () =>
              deleteScene(song.id, scene.id),
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
    [
      song.id,
      recaptureScene,
      moveScene,
      deleteScene,
      runLibraryEdit,
      presets,
      applySnapshot,
      savePresetToTile,
    ],
  );

  const handleRenameScene = useCallback(
    (label: string) => {
      if (dialog.kind !== 'rename') return;
      const sceneId = dialog.scene.id;
      setDialog({ kind: 'closed' });
      void runLibraryEdit('Renaming this scene', () =>
        renameScene(song.id, sceneId, label),
      );
    },
    [dialog, song.id, renameScene, runLibraryEdit],
  );

  const handleSaveNotes = useCallback(
    (notes: string) => {
      if (dialog.kind !== 'notes') return;
      const sceneId = dialog.scene.id;
      setDialog({ kind: 'closed' });
      void runLibraryEdit("Editing this scene's notes", () =>
        setSceneNotes(song.id, sceneId, notes),
      );
    },
    [dialog, song.id, setSceneNotes, runLibraryEdit],
  );

  const handleArmToggle = useCallback(async () => {
    if (isArmed) {
      onArm(null);
      return;
    }
    const proceed = await confirmArmForCapture(
      song,
      findLibraryUses,
      countSetlistsUsing,
    );
    if (proceed) onArm(song.id);
  }, [isArmed, onArm, song, findLibraryUses, countSetlistsUsing]);

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
          {song.name}
        </div>
        <div className="text-xs mt-0.5 text-zinc-500">
          {sceneCountLabel(song.scenes.length)}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onPerform(song.id)}
            disabled={song.scenes.length === 0}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              isLightMode
                ? 'bg-white text-cyan-700 border border-cyan-200 shadow-sm'
                : 'bg-zinc-800 text-cyan-400 border border-cyan-900/50'
            }`}
          >
            PERFORM SONG
          </button>
          <button
            onClick={() => void handleArmToggle()}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest transition-colors ${
              isArmed
                ? isLightMode
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-amber-900/30 text-amber-300 border border-amber-700/50'
                : isLightMode
                  ? 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            {isArmed ? 'STOP CAPTURE' : 'ARM FOR CAPTURE'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {song.scenes.map((scene, index) => (
          <SceneRow
            key={scene.id}
            scene={scene}
            index={index}
            total={song.scenes.length}
            compact={compact}
            isLightMode={isLightMode}
            onAction={handleSceneAction}
          />
        ))}
      </div>
      {dialog.kind === 'rename' && (
        <NamingDialog
          title="Rename scene"
          confirmLabel="Save"
          initialValue={dialog.scene.label}
          placeholder="Scene name"
          isLightMode={isLightMode}
          onConfirm={handleRenameScene}
          onCancel={() => setDialog({ kind: 'closed' })}
        />
      )}
      {dialog.kind === 'notes' && (
        <NamingDialog
          title="Scene notes"
          confirmLabel="Save"
          initialValue={dialog.scene.notes}
          placeholder="Notes"
          multiline
          isLightMode={isLightMode}
          onConfirm={handleSaveNotes}
          onCancel={() => setDialog({ kind: 'closed' })}
        />
      )}
    </div>
  );
}
