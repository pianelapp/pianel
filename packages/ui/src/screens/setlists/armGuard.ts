import { showAlert } from '../../components/modals/AlertModal';
import { setlistCountLabel } from './labels';
import type { Song } from '../../store';

export async function confirmArmForCapture(
  song: Song,
  findLibraryUses: (songId: string) => Array<{ setlistId: string; entryIndex: number }>,
  countSetlistsUsing: (songId: string) => number,
): Promise<boolean> {
  const uses = findLibraryUses(song.id);
  if (uses.length === 0) return true;
  return showAlert({
    variant: 'warning',
    title: `This song is in ${setlistCountLabel(countSetlistsUsing(song.id))}`,
    message: `Scenes you capture into "${song.name}" will be added to them too.`,
    confirmLabel: 'Arm anyway',
    cancelLabel: 'Cancel',
  });
}
