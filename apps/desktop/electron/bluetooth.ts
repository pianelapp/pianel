import { BrowserWindow, ipcMain } from 'electron';

let pendingCallback: ((deviceId: string) => void) | null = null;

export function registerBluetoothHandler(mainWindow: BrowserWindow): void {
  mainWindow.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault();
    pendingCallback = callback;
    mainWindow.webContents.send(
      'bluetooth:devices',
      devices.map((d) => ({ deviceId: d.deviceId, deviceName: d.deviceName })),
    );
  });

  ipcMain.on('bluetooth:select', (_event, deviceId: string) => {
    if (pendingCallback) {
      pendingCallback(deviceId);
      pendingCallback = null;
    }
  });

  ipcMain.on('bluetooth:cancel', () => {
    if (pendingCallback) {
      pendingCallback('');
      pendingCallback = null;
    }
  });
}
