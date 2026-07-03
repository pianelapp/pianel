/**
 * Task 3.1 — failing tests for the web file picker adapter.
 *
 * Covers:
 *  - export (save) via the File System Access API with the suggested filename;
 *  - import (open) via the FSA API returning UTF-8 contents;
 *  - the fallback branch (no FSA API) reading via a file <input> and writing
 *    via a download <a> anchor;
 *  - cancel semantics: open-cancel -> null (no error, no mutation);
 *    save-picker cancel -> false (not saved).
 */
import type { FilePickerAdapter } from '@pianel/core/services/profiles/FilePickerAdapter';
import { createWebFilePicker } from '../src/services/webFilePicker';

describe('createWebFilePicker', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
    delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
  });

  it('satisfies the FilePickerAdapter contract shape', () => {
    const picker: FilePickerAdapter = createWebFilePicker();
    expect(typeof picker.openProfileJson).toBe('function');
    expect(typeof picker.saveProfileJson).toBe('function');
  });

  describe('File System Access API path', () => {
    it('saves via showSaveFilePicker using the suggested filename and resolves true', async () => {
      const written: string[] = [];
      const close = jest.fn();
      const write = jest.fn(async (data: string) => { written.push(data); });
      const createWritable = jest.fn(async () => ({ write, close }));
      const showSaveFilePicker = jest.fn(async (opts: { suggestedName?: string }) => {
        expect(opts.suggestedName).toBe('My Profile.json');
        return { createWritable };
      });
      (window as unknown as Record<string, unknown>).showSaveFilePicker = showSaveFilePicker;

      const picker = createWebFilePicker();
      const ok = await picker.saveProfileJson('My Profile.json', '{"a":1}');

      expect(ok).toBe(true);
      expect(showSaveFilePicker).toHaveBeenCalledTimes(1);
      expect(written).toEqual(['{"a":1}']);
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('returns false when the save picker is cancelled (AbortError)', async () => {
      const showSaveFilePicker = jest.fn(async () => {
        throw new DOMException('The user aborted a request.', 'AbortError');
      });
      (window as unknown as Record<string, unknown>).showSaveFilePicker = showSaveFilePicker;

      const picker = createWebFilePicker();
      await expect(picker.saveProfileJson('x.json', '{}')).resolves.toBe(false);
    });

    it('opens via showOpenFilePicker and returns verbatim UTF-8 contents', async () => {
      const fileContents = '{"schemaVersion":1,"name":"é piano"}';
      const getFile = jest.fn(async () => ({
        text: async () => fileContents,
      }));
      const showOpenFilePicker = jest.fn(async () => [{ getFile }]);
      (window as unknown as Record<string, unknown>).showOpenFilePicker = showOpenFilePicker;

      const picker = createWebFilePicker();
      const contents = await picker.openProfileJson();

      expect(contents).toBe(fileContents);
      expect(showOpenFilePicker).toHaveBeenCalledTimes(1);
    });

    it('returns null when the open picker is cancelled (AbortError)', async () => {
      const showOpenFilePicker = jest.fn(async () => {
        throw new DOMException('The user aborted a request.', 'AbortError');
      });
      (window as unknown as Record<string, unknown>).showOpenFilePicker = showOpenFilePicker;

      const picker = createWebFilePicker();
      await expect(picker.openProfileJson()).resolves.toBeNull();
    });
  });

  describe('fallback path (no File System Access API)', () => {
    it('writes via a download anchor and resolves true', async () => {
      // No FSA API present on window.
      const clicked: HTMLAnchorElement[] = [];
      const clickSpy = jest
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
          clicked.push(this);
        });
      const createObjectURL = jest.fn(() => 'blob:fake');
      const revokeObjectURL = jest.fn();
      (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;
      (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeObjectURL;

      const picker = createWebFilePicker();
      const ok = await picker.saveProfileJson('Backup.json', '{"k":"v"}');

      expect(ok).toBe(true);
      expect(clicked).toHaveLength(1);
      expect(clicked[0].download).toBe('Backup.json');
      expect(createObjectURL).toHaveBeenCalledTimes(1);

      clickSpy.mockRestore();
    });

    it('reads via a hidden file input and returns the file contents', async () => {
      const fileContents = '{"schemaVersion":1}';
      const file = new File([fileContents], 'profile.json', { type: 'application/json' });

      // When the adapter clicks the input, simulate the user choosing a file.
      const clickSpy = jest
        .spyOn(HTMLInputElement.prototype, 'click')
        .mockImplementation(function (this: HTMLInputElement) {
          Object.defineProperty(this, 'files', { value: [file], configurable: true });
          this.dispatchEvent(new Event('change'));
        });

      const picker = createWebFilePicker();
      const contents = await picker.openProfileJson();

      expect(contents).toBe(fileContents);
      clickSpy.mockRestore();
    });

    it('resolves null when the fallback file input is cancelled', async () => {
      // Simulate a cancel: the input fires cancel without selecting a file.
      const clickSpy = jest
        .spyOn(HTMLInputElement.prototype, 'click')
        .mockImplementation(function (this: HTMLInputElement) {
          this.dispatchEvent(new Event('cancel'));
        });

      const picker = createWebFilePicker();
      await expect(picker.openProfileJson()).resolves.toBeNull();
      clickSpy.mockRestore();
    });
  });
});
