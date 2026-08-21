import { createElement } from 'react';
import Unplug from 'lucide-react/dist/esm/icons/unplug';
import PlugZap from 'lucide-react/dist/esm/icons/plug-zap';
import { useConnectionStore } from '../store';
import { showAlert } from '../components/modals/AlertModal';
import type { ConnectionStatus } from '../store';

const CAPTURE_BLOCKED: Record<string, { title: string; message: string; stale: boolean }> = {
  stale: {
    title: 'Piano not responding',
    message:
      'The piano has gone quiet, so the app may be showing an out-of-date sound. Wait a moment for it to answer, then capture.',
    stale: true,
  },
  connecting: {
    title: 'Still connecting',
    message: 'Wait for the piano to finish connecting, then capture.',
    stale: true,
  },
  scanning: {
    title: 'Still looking for the piano',
    message: 'Wait for the scan to finish, then capture.',
    stale: true,
  },
  discovered: {
    title: 'Piano not connected yet',
    message: 'Tap connect to finish pairing with the piano, then capture.',
    stale: true,
  },
};

const CAPTURE_DISCONNECTED = {
  title: 'Piano not connected',
  message: 'Capturing reads the sound from the piano. Connect it first, then capture.',
  stale: false,
};

export function requireConnectedPiano(): boolean {
  const status: ConnectionStatus = useConnectionStore.getState().status;
  if (status === 'connected') return true;

  const copy = CAPTURE_BLOCKED[status] ?? CAPTURE_DISCONNECTED;
  showAlert({
    variant: 'warning',
    title: copy.title,
    message: copy.message,
    icon: createElement(copy.stale ? PlugZap : Unplug, {
      className: 'w-7 h-7 text-amber-500',
    }),
  });
  return false;
}
