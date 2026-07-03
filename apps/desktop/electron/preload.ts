import { contextBridge, ipcRenderer } from 'electron';
import Store from 'electron-store';

interface BluetoothDeviceInfo {
  deviceId: string;
  deviceName: string;
}

const store = new Store<Record<string, string>>({ name: 'fp30x-config', clearInvalidConfig: true });

contextBridge.exposeInMainWorld('electronStorageBridge', {
  getItem: (key: string): string | null => {
    const val = store.get(key);
    return typeof val === 'string' ? val : null;
  },
  setItem: (key: string, value: string): void => {
    store.set(key, value);
  },
  removeItem: (key: string): void => {
    store.delete(key);
  },
});

contextBridge.exposeInMainWorld('bluetoothBridge', {
  onDeviceList: (cb: (devices: BluetoothDeviceInfo[]) => void): (() => void) => {
    const listener = (_: unknown, devices: BluetoothDeviceInfo[]) => cb(devices);
    ipcRenderer.on('bluetooth:devices', listener);
    return () => ipcRenderer.off('bluetooth:devices', listener);
  },

  selectDevice: (deviceId: string): void => {
    ipcRenderer.send('bluetooth:select', deviceId);
  },

  cancel: (): void => {
    ipcRenderer.send('bluetooth:cancel');
  },
});

contextBridge.exposeInMainWorld('fileBridge', {
  openProfileJson: (): Promise<string | null> =>
    ipcRenderer.invoke('file:open'),
  saveProfileJson: (
    suggestedFilename: string,
    contents: string,
  ): Promise<boolean> =>
    ipcRenderer.invoke('file:save', suggestedFilename, contents),
});
