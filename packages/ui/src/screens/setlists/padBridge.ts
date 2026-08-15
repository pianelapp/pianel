import { showAlert } from '../../components/modals/AlertModal';
import { PRESET_TILE_COUNT } from '../../store';
import type { Preset, PerformanceSnapshot, Scene } from '../../store';

function firstFreeTile(presets: Preset[]): number | null {
  const used = new Set(presets.map(p => p.tilePosition));
  for (let position = 0; position < PRESET_TILE_COUNT; position++) {
    if (!used.has(position)) return position;
  }
  return null;
}

export async function saveSceneAsPad(
  scene: Scene,
  presets: Preset[],
  applySnapshot: (snapshot: PerformanceSnapshot) => Promise<void>,
  savePresetToTile: (tilePosition: number, label: string) => Promise<Preset | null>,
): Promise<void> {
  const free = firstFreeTile(presets);
  if (free === null) {
    await showAlert({
      variant: 'warning',
      title: 'No free pad',
      message: 'All 8 pad tiles are in use. Delete one first.',
    });
    return;
  }

  const confirmed = await showAlert({
    variant: 'warning',
    title: 'Save scene as pad?',
    message: `This will load the scene onto the piano, then save it to pad ${free + 1}.`,
    confirmLabel: 'Save',
    cancelLabel: 'Cancel',
  });
  if (!confirmed) return;

  await applySnapshot(scene.snapshot).catch(() => {});

  try {
    await savePresetToTile(free, scene.label);
  } catch (err) {
    await showAlert({
      variant: 'error',
      title: 'Could not save pad',
      message: err instanceof Error ? err.message : 'Unknown error.',
    });
  }
}
