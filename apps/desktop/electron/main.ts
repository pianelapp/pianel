import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import Store from 'electron-store';
import { registerBluetoothHandler } from './bluetooth';

function registerFileBridgeHandlers(): void {
  ipcMain.handle('file:open', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Import profile',
      filters: [{ name: 'FP-30X Profile', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return readFile(result.filePaths[0], 'utf-8');
  });

  ipcMain.handle(
    'file:save',
    async (
      _evt,
      suggestedFilename: string,
      contents: string,
    ): Promise<boolean> => {
      const result = await dialog.showSaveDialog({
        title: 'Export profile',
        defaultPath: suggestedFilename,
        filters: [{ name: 'FP-30X Profile', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return false;
      await writeFile(result.filePath, contents, 'utf-8');
      return true;
    },
  );
}

Store.initRenderer();

const isDev = !app.isPackaged;

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 600,
    show: true,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs require() for electron-store
      webSecurity: true,
    },
  });

  mainWindow.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
    if (['bluetooth', 'midi', 'midiSysex'].includes(permission as string)) return true;
    return null as unknown as boolean;
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['bluetooth', 'midi', 'midiSysex'].includes(permission as string));
  });

  mainWindow.webContents.session.setBluetoothPairingHandler((_details, callback) => {
    callback({ confirmed: true });
  });

  registerBluetoothHandler(mainWindow);

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  app.on('browser-window-created', (_, window) => {
    window.webContents.on('before-input-event', (_e, input) => {
      if (input.key === 'F12') {
        window.webContents.toggleDevTools();
      }
    });
  });

  registerFileBridgeHandlers();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
