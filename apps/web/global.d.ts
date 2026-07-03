/**
 * Ambient declarations for the web workspace.
 *
 * The web build consumes the shared renderer source via the `@pianel/ui` alias
 * and supplies its own browser/PWA host adapters. The `*.css` module declaration below keeps the
 * `@pianel/ui/styles/global.css` side-effect import type-clean under
 * `tsc --noEmit`. The `Window` bridge augmentations are retained as harmless
 * ambient context for any platform-bridge typing the host may reference.
 */

/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/info" />

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
  saveProfileJson(
    suggestedFilename: string,
    contents: string,
  ): Promise<boolean>;
}

declare global {
  interface Window {
    electronStorageBridge: ElectronStorageBridge;
    bluetoothBridge: {
      onDeviceList: (
        cb: (devices: BluetoothDeviceInfo[]) => void,
      ) => () => void;
      selectDevice: (deviceId: string) => void;
      cancel: () => void;
    };
    fileBridge: FileBridge;
  }
}

declare module "*.css" {
  const content: string;
  export default content;
}

export {};
