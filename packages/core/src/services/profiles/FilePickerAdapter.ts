/**
 * FilePickerAdapter — platform-IO abstraction for JSON profile export/import.
 *
 * Constitution V keeps `packages/core` free of RN-only or Electron-only
 * dependencies, so each app injects its own implementation:
 *   - `apps/mobile/src/services/filePicker.mobile.ts`  (Share + DocumentPicker)
 *   - `apps/desktop/src/services/filePicker.desktop.ts` (Electron dialog IPC)
 */

export interface FilePickerAdapter {
  /** Open a single .json file. Resolves to UTF-8 contents, or `null` on cancel. */
  openProfileJson(): Promise<string | null>;

  /** Save a UTF-8 string with a suggested filename. Resolves `true` on save,
   *  `false` on cancel. */
  saveProfileJson(suggestedFilename: string, contents: string): Promise<boolean>;
}

/** Convenience alias used by tests that pass a mock. */
export type MockFilePickerAdapter = FilePickerAdapter;
