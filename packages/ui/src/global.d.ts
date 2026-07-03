interface BluetoothDeviceInfo {
  deviceId: string;
  deviceName: string;
}

interface ElectronStorageBridge {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface FileBridge {
  openProfileJson(): Promise<string | null>;
  saveProfileJson(suggestedFilename: string, contents: string): Promise<boolean>;
}

declare global {
  interface Window {
    electronStorageBridge: ElectronStorageBridge;
    bluetoothBridge: {
      onDeviceList: (cb: (devices: BluetoothDeviceInfo[]) => void) => () => void;
      selectDevice: (deviceId: string) => void;
      cancel: () => void;
    };
    fileBridge: FileBridge;
  }
}

declare module '*.css' {
  const content: string;
  export default content;
}

export {};
