import { showAlert } from '../../components/modals/AlertModal';
import { requireConnectedPiano } from '../../hooks/captureGuard';

export async function confirmRecapture(sceneLabel: string): Promise<boolean> {
  if (!requireConnectedPiano()) return false;
  return showAlert({
    variant: 'warning',
    title: 'Re-capture this scene?',
    message: `"${sceneLabel}" will store what the piano is playing right now, replacing the sound saved in it. This cannot be undone.`,
    confirmLabel: 'Re-capture',
    cancelLabel: 'Cancel',
  });
}
