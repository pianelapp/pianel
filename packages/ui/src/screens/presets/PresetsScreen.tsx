import { useCallback, useEffect, useState } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { usePresets } from '../../hooks/usePresets';
import { useSongs } from '../../hooks/useSongs';
import { PRESET_TILE_COUNT } from '../../store';
import type { Preset, Song } from '../../store';
import { PresetTile } from './PresetTile';
import { PresetContextMenu } from './PresetContextMenu';
import { PresetNamingDialog } from './PresetNamingDialog';
import { showAlert } from '../../components/modals/AlertModal';

interface PresetsScreenProps {
  isLightMode: boolean;
}

type DialogState =
  | { kind: 'closed' }
  | { kind: 'save'; position: number }
  | { kind: 'rename'; preset: Preset }
  | { kind: 'addAsScene'; preset: Preset };

type MenuState =
  | { kind: 'closed' }
  | { kind: 'open'; preset: Preset; x: number; y: number };

interface SongPickerDialogProps {
  songs: Song[];
  isLightMode: boolean;
  onSelect: (songId: string) => void;
  onCancel: () => void;
}

function SongPickerDialog({ songs, isLightMode, onSelect, onCancel }: SongPickerDialogProps) {
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
      aria-labelledby="add-pad-as-scene-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        className={`w-[320px] max-h-[70vh] rounded-3xl p-6 shadow-2xl border flex flex-col ${
          isLightMode ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <h2
          id="add-pad-as-scene-dialog-title"
          className={`text-lg font-bold mb-4 shrink-0 ${
            isLightMode ? 'text-zinc-800' : 'text-zinc-100'
          }`}
        >
          Add pad as scene
        </h2>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar -mx-2 px-2">
          {songs.length === 0 ? (
            <div
              className={`text-sm text-center py-6 ${
                isLightMode ? 'text-zinc-400' : 'text-zinc-600'
              }`}
            >
              No songs yet. Add one from the SETLISTS tab first.
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

export function PresetsScreen({ isLightMode }: PresetsScreenProps) {
  const { presets, savePresetToTile, applyPreset, updatePreset, renamePreset, deletePreset } =
    usePresets();
  const { songs, addPadAsScene } = useSongs();

  const isMobile = useBreakpoint().viewport === 'mobile';

  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [menu, setMenu] = useState<MenuState>({ kind: 'closed' });

  const byPosition = new Map<number, Preset>();
  presets.forEach(p => byPosition.set(p.tilePosition, p));

  const handlePresetClick = useCallback(
    (position: number) => {
      const filled = byPosition.get(position);
      if (!filled) {
        setDialog({ kind: 'save', position });
        return;
      }
      applyPreset(filled.id).catch(() => {
        // Apply failure surfaces via piano echo / status; no UI error here.
      });
    },
    [applyPreset, byPosition],
  );

  const handlePresetContextMenu = useCallback(
    (position: number, event: React.MouseEvent) => {
      const filled = byPosition.get(position);
      if (!filled) return;
      event.preventDefault();
      setMenu({ kind: 'open', preset: filled, x: event.clientX, y: event.clientY });
    },
    [byPosition],
  );

  const handlePresetLongPress = useCallback(
    (position: number, point: { x: number; y: number }) => {
      const filled = byPosition.get(position);
      if (!filled) return;
      setMenu({ kind: 'open', preset: filled, x: point.x, y: point.y });
    },
    [byPosition],
  );

  const handleSave = useCallback(
    async (label: string) => {
      if (dialog.kind !== 'save') return;
      try {
        await savePresetToTile(dialog.position, label);
      } catch (err) {
        await showAlert({
          variant: 'error',
          title: 'Could not save preset',
          message: err instanceof Error ? err.message : 'Unknown error.',
        });
      }
      setDialog({ kind: 'closed' });
    },
    [dialog, savePresetToTile],
  );

  const handleRename = useCallback(
    async (label: string) => {
      if (dialog.kind !== 'rename') return;
      try {
        await renamePreset(dialog.preset.id, label);
      } catch (err) {
        await showAlert({
          variant: 'error',
          title: 'Could not rename preset',
          message: err instanceof Error ? err.message : 'Unknown error.',
        });
      }
      setDialog({ kind: 'closed' });
    },
    [dialog, renamePreset],
  );

  const handleMenuAction = useCallback(
    async (action: 'update' | 'rename' | 'addAsScene' | 'delete') => {
      if (menu.kind !== 'open') return;
      const preset = menu.preset;
      setMenu({ kind: 'closed' });
      if (action === 'update') {
        await updatePreset(preset.id);
      } else if (action === 'rename') {
        setDialog({ kind: 'rename', preset });
      } else if (action === 'addAsScene') {
        setDialog({ kind: 'addAsScene', preset });
      } else if (action === 'delete') {
        const confirmed = await showAlert({
          variant: 'warning',
          title: 'Delete preset?',
          message: `Delete preset "${preset.label}"? This cannot be undone.`,
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
        });
        if (confirmed) {
          await deletePreset(preset.id);
        }
      }
    },
    [menu, updatePreset, deletePreset],
  );

  const handleAddPadAsScene = useCallback(
    (songId: string) => {
      if (dialog.kind !== 'addAsScene') return;
      addPadAsScene(songId, dialog.preset);
      setDialog({ kind: 'closed' });
    },
    [dialog, addPadAsScene],
  );

  return (
    <div className="w-full h-full flex flex-col px-8 py-4">
      <div
        className={
          isMobile
            ? 'flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-3 pb-3'
            : 'flex-1 grid grid-cols-4 grid-rows-2 gap-3 pb-3'
        }>
        {Array.from({ length: PRESET_TILE_COUNT }, (_, i) => {
          const preset = byPosition.get(i) ?? null;
          return (
            <PresetTile
              key={i}
              position={i}
              preset={preset}
              isLightMode={isLightMode}
              className={isMobile ? 'min-h-[72px] shrink-0' : undefined}
              onClick={() => handlePresetClick(i)}
              onContextMenu={evt => handlePresetContextMenu(i, evt)}
              onLongPress={preset ? point => handlePresetLongPress(i, point) : undefined}
            />
          );
        })}
      </div>

      {dialog.kind === 'save' && (
        <PresetNamingDialog
          title="Save preset"
          confirmLabel="Save"
          initialValue={`Preset ${dialog.position + 1}`}
          isLightMode={isLightMode}
          onConfirm={handleSave}
          onCancel={() => setDialog({ kind: 'closed' })}
        />
      )}
      {dialog.kind === 'rename' && (
        <PresetNamingDialog
          title="Rename preset"
          confirmLabel="Rename"
          initialValue={dialog.preset.label}
          isLightMode={isLightMode}
          onConfirm={handleRename}
          onCancel={() => setDialog({ kind: 'closed' })}
        />
      )}
      {menu.kind === 'open' && (
        <PresetContextMenu
          x={menu.x}
          y={menu.y}
          isLightMode={isLightMode}
          onClose={() => setMenu({ kind: 'closed' })}
          onAction={handleMenuAction}
        />
      )}
      {dialog.kind === 'addAsScene' && (
        <SongPickerDialog
          songs={songs}
          isLightMode={isLightMode}
          onSelect={handleAddPadAsScene}
          onCancel={() => setDialog({ kind: 'closed' })}
        />
      )}
    </div>
  );
}
