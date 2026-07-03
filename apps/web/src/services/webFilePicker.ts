/**
 * Web `FilePickerAdapter` (Task 3.2).
 *
 * Replaces the Electron file dialogs with browser-native import/export:
 *  - Export: prefer the File System Access `showSaveFilePicker` with a
 *    suggested filename; fall back to a download-link `Blob` when the API is
 *    absent.
 *  - Import: prefer `showOpenFilePicker`; fall back to a hidden
 *    `<input type="file" accept=".json,application/json">`.
 *
 * Both operations must run from a user-gesture handler (the pickers require
 * user activation) and are only available in a secure context. Contents are
 * returned/written verbatim as UTF-8 — the adapter performs no schema
 * interpretation; validation stays in `@pianel/core`'s `ProfileService`.
 */
import type { FilePickerAdapter } from '@pianel/core/services/profiles/FilePickerAdapter';

interface FsaWritable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
interface FsaSaveHandle {
  createWritable(): Promise<FsaWritable>;
}
interface FsaOpenHandle {
  getFile(): Promise<{ text(): Promise<string> }>;
}
type ShowSaveFilePicker = (opts: {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}) => Promise<FsaSaveHandle>;
type ShowOpenFilePicker = (opts: {
  multiple?: boolean;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}) => Promise<FsaOpenHandle[]>;

const JSON_TYPES = [
  { description: 'JSON profile', accept: { 'application/json': ['.json'] } },
];

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Read a selected file as UTF-8 text. Uses `FileReader` (universally supported,
 * including in test environments) rather than `Blob.prototype.text`.
 */
function readFileAsText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsText(file);
  });
}

export function createWebFilePicker(): FilePickerAdapter {
  const saveViaFsa = async (
    suggestedFilename: string,
    contents: string,
  ): Promise<boolean> => {
    const showSaveFilePicker = (window as unknown as {
      showSaveFilePicker?: ShowSaveFilePicker;
    }).showSaveFilePicker;
    try {
      const handle = await showSaveFilePicker!({
        suggestedName: suggestedFilename,
        types: JSON_TYPES,
      });
      const writable = await handle.createWritable();
      await writable.write(contents);
      await writable.close();
      return true;
    } catch (err) {
      if (isAbort(err)) return false;
      throw err;
    }
  };

  const saveViaAnchor = (
    suggestedFilename: string,
    contents: string,
  ): Promise<boolean> => {
    const blob = new Blob([contents], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = suggestedFilename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    // The anchor fallback cannot observe a cancelled save dialog, so it
    // resolves true once the download is initiated (documented behavior).
    return Promise.resolve(true);
  };

  const openViaFsa = async (): Promise<string | null> => {
    const showOpenFilePicker = (window as unknown as {
      showOpenFilePicker?: ShowOpenFilePicker;
    }).showOpenFilePicker;
    try {
      const [handle] = await showOpenFilePicker!({
        multiple: false,
        types: JSON_TYPES,
      });
      if (!handle) return null;
      const file = await handle.getFile();
      return await file.text();
    } catch (err) {
      if (isAbort(err)) return null;
      throw err;
    }
  };

  const openViaInput = (): Promise<string | null> =>
    new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.position = 'fixed';
      input.style.left = '-9999px';

      let settled = false;
      const cleanup = () => {
        input.remove();
      };
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) {
          finish(null);
          return;
        }
        readFileAsText(file)
          .then((text) => finish(text))
          .catch(() => finish(null));
      });
      // Some browsers emit a `cancel` event when the chooser is dismissed.
      input.addEventListener('cancel', () => finish(null));

      document.body.appendChild(input);
      input.click();
    });

  return {
    async openProfileJson(): Promise<string | null> {
      if ('showOpenFilePicker' in window) {
        return openViaFsa();
      }
      return openViaInput();
    },
    async saveProfileJson(
      suggestedFilename: string,
      contents: string,
    ): Promise<boolean> {
      if ('showSaveFilePicker' in window) {
        return saveViaFsa(suggestedFilename, contents);
      }
      return saveViaAnchor(suggestedFilename, contents);
    },
  };
}

/** Default singleton, mirroring `desktopFilePicker`. */
export const webFilePicker: FilePickerAdapter = createWebFilePicker();
