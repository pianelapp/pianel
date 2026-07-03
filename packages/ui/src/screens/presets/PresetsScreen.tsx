/**
 * PresetsScreen — 4×2 grid of 8 preset slots scoped to the active profile's
 * `presets[]`.
 *
 * - Empty slots open the naming dialog (pre-filled "Preset N") when clicked.
 * - Filled slots apply the preset when clicked, and open the context menu
 *   (Update / Rename / Delete) on right-click (FR-024 desktop half).
 */

import { useCallback, useState } from 'react';
import { usePresets } from '../../hooks/usePresets';
import { PRESET_TILE_COUNT } from '../../store';
import type { Preset } from '../../store';
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
  | { kind: 'rename'; preset: Preset };

type MenuState =
  | { kind: 'closed' }
  | { kind: 'open'; preset: Preset; x: number; y: number };

export function PresetsScreen({ isLightMode }: PresetsScreenProps) {
  const { presets, savePresetToTile, applyPreset, updatePreset, renamePreset, deletePreset } =
    usePresets();

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
    async (action: 'update' | 'rename' | 'delete') => {
      if (menu.kind !== 'open') return;
      const preset = menu.preset;
      setMenu({ kind: 'closed' });
      if (action === 'update') {
        await updatePreset(preset.id);
      } else if (action === 'rename') {
        setDialog({ kind: 'rename', preset });
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

  return (
    <div className="w-full h-full flex flex-col px-8 py-4">
      <div className="flex-1 grid grid-cols-4 grid-rows-2 gap-3 pb-3">
        {Array.from({ length: PRESET_TILE_COUNT }, (_, i) => {
          const preset = byPosition.get(i) ?? null;
          return (
            <PresetTile
              key={i}
              position={i}
              preset={preset}
              isLightMode={isLightMode}
              onClick={() => handlePresetClick(i)}
              onContextMenu={evt => handlePresetContextMenu(i, evt)}
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
    </div>
  );
}
