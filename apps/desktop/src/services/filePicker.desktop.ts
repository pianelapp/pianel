/**
 * Desktop FilePickerAdapter — delegates to the `fileBridge` exposed by
 * `electron/preload.ts`, which proxies through IPC to `dialog.showOpenDialog`
 * / `showSaveDialog` in `electron/main.ts`.
 */

import type { FilePickerAdapter } from '@pianel/core/services/profiles/FilePickerAdapter';

export const desktopFilePicker: FilePickerAdapter = {
  async openProfileJson(): Promise<string | null> {
    return window.fileBridge.openProfileJson();
  },
  async saveProfileJson(
    suggestedFilename: string,
    contents: string,
  ): Promise<boolean> {
    return window.fileBridge.saveProfileJson(suggestedFilename, contents);
  },
};
