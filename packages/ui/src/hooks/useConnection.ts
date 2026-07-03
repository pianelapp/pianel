import { useCallback, createElement } from 'react';
import Unplug from 'lucide-react/dist/esm/icons/unplug';
import { useConnectionStore } from '../store';
import { showAlert } from '../components/modals/AlertModal';
import type { ConnectionService } from '@pianel/core/services/ConnectionService';

let connectionService: ConnectionService | null = null;

export function setConnectionService(service: ConnectionService): void {
  connectionService = service;
}

function reportConnectError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const isNoDevices = /no midi devices found/i.test(message);

  if (isNoDevices) {
    showAlert({
      variant: 'warning',
      title: 'No piano found',
      message:
        'Connect your Piano via USB cable, or pair it via Bluetooth in OS System Settings. Then try again.',
      icon: createElement(Unplug, {
        className: 'w-7 h-7 text-amber-500',
      }),
    });
  } else {
    showAlert({
      variant: 'error',
      title: 'Connection failed',
      message,
    });
  }
}

export function useConnection() {
  const status = useConnectionStore(s => s.status);
  const deviceId = useConnectionStore(s => s.deviceId);
  const deviceName = useConnectionStore(s => s.deviceName);
  const isFirstConnectionThisSession = useConnectionStore(
    s => s.isFirstConnectionThisSession,
  );

  const connect = useCallback(async () => {
    if (!connectionService) {
      showAlert({
        variant: 'error',
        title: 'Service unavailable',
        message:
          'Connection service is not initialized. Reload the app and try again.',
      });
      return;
    }
    try {
      // No deviceId — WebMIDITransport falls back to its single-output / chooser path.
      await connectionService.connect('');
    } catch (err) {
      reportConnectError(err);
    }
  }, []);

  const connectToDevice = useCallback(async (id: string) => {
    if (!connectionService) return;
    try {
      await connectionService.connect(id);
    } catch (err) {
      reportConnectError(err);
    }
  }, []);

  const refreshDiscoveredDevices = useCallback(async () => {
    if (!connectionService) return;
    try {
      await connectionService.refreshDiscoveredDevices();
    } catch {
      // Non-fatal: panel will show empty list and surface its own error UI if needed.
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!connectionService) return;
    await connectionService.disconnect();
  }, []);

  return {
    status,
    deviceId,
    deviceName,
    isFirstConnectionThisSession,
    connect,
    connectToDevice,
    refreshDiscoveredDevices,
    disconnect,
    isConnected: status === 'connected',
    isScanning: status === 'scanning',
    isConnecting: status === 'connecting',
    isStale: status === 'stale',
  };
}
