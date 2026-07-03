/**
 * Web ProfileService wiring (Task 3.3).
 *
 * Constructs the shared `@pianel/core` `ProfileService` with the web
 * `FilePickerAdapter` injected in place of the Electron `desktopFilePicker`.
 * The service contract is unchanged; only the host file-IO adapter differs.
 *
 * This mirrors the desktop wiring in `apps/desktop/src/main.tsx`, but is
 * factored into a small helper so the web entry (Task 5) and integration
 * tests can construct the service with an explicit picker.
 */
import { ProfileService } from '@pianel/core/services/profiles/ProfileService';
import type { PianoService } from '@pianel/core/services/PianoService';
import type { PresetService } from '@pianel/core/services/presets/PresetService';
import type { FilePickerAdapter } from '@pianel/core/services/profiles/FilePickerAdapter';
import { webFilePicker } from './webFilePicker';

export function createWebProfileService(
  pianoService: PianoService,
  presetService: PresetService,
  filePicker: FilePickerAdapter = webFilePicker,
): ProfileService {
  return new ProfileService(pianoService, filePicker, presetService);
}
