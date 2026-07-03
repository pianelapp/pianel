/**
 * Web entry.
 *
 * The single web entry. The web app shares only the platform-agnostic engine
 * (`@pianel/core`) and the cross-host renderer (`@pianel/ui`) — it does not depend
 * on `apps/desktop`. It supplies its own browser/PWA host adapters:
 *  - Injects the web host adapters: the IndexedDB-backed `StateStorage` (bound
 *    into the shared store registry via `initStores`), the web `FilePickerAdapter`
 *    (`webFilePicker`, via `createWebProfileService`), and the shared
 *    `WebMIDITransport` (wrapped by `WebHostMIDITransport` for browser-aware
 *    permission/error UX — no transport behavior changed).
 *  - Wires the core services exactly as the desktop host does
 *    (ConnectionService / PianoService / PresetService / ProfileService), then
 *    registers the singletons the shared hooks read. Presentation accesses
 *    everything through hooks only — no engine/transport is imported by
 *    presentation.
 *  - Runs the bootstrap sequence (default profile on first launch; restore
 *    boot/active profile on relaunch), awaiting the first async storage read to
 *    avoid a hydration race (Req 4.5).
 *  - Mounts the web app shell, which mounts the reused `App`, strips the macOS
 *    titlebar chrome, applies viewport/touch config, and gates the connect
 *    affordance via capability detection.
 */
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { WebMIDITransport } from '@pianel/ui/transport/WebMIDITransport';
import { requestMIDIDeviceSelection } from '@pianel/ui/components/MIDIDeviceChooser';
import { ConnectionService } from '@pianel/core/services/ConnectionService';
import { PianoService } from '@pianel/core/services/PianoService';
import { PresetService } from '@pianel/core/services/presets/PresetService';
import { setPianoService } from '@pianel/ui/hooks/usePiano';
import { setConnectionService } from '@pianel/ui/hooks/useConnection';
import { setProfileService } from '@pianel/ui/hooks/useProfiles';
import {
  syncChordAccidentalsFromStore,
  subscribeChordAccidentals,
} from '@pianel/ui/host/chordAccidentalSync';
import { initStores, useAppSettingsStore, useProfilesStore, webStorage } from './store';
import { createWebProfileService } from './services/profileService.web';
import { WebHostMIDITransport } from './host/WebHostMIDITransport';
import { runBootstrap } from './host/bootstrap';
import { registerPwa } from './host/registerPwa';
import { WebAppShell } from './host/WebAppShell';
import '@pianel/ui/styles/global.css';
import './host/webShell.css';

// ── Stores ───────────────────────────────────────────────────────────────────
// Bind the shared domain stores to the web IndexedDB storage substrate before
// any store is read or the app renders.
initStores(webStorage);

// ── Transport ──────────────────────────────────────────────────────────────
// Use the shared WebMIDITransport; wrap it so connect-time browser
// permission/error conditions map to actionable web-host copy. The multi-device
// chooser is the same imperative UI the desktop host uses.
WebMIDITransport.chooser = requestMIDIDeviceSelection;
const transport = new WebHostMIDITransport(new WebMIDITransport());

// ── Core services (wired identically to desktop) ─────────────────────────────
const pianoService = new PianoService(transport);
const connectionService = new ConnectionService(transport);
const presetService = new PresetService(pianoService);
const profileService = createWebProfileService(pianoService, presetService);

connectionService.setPianoService(pianoService);
connectionService.setNotificationHandler((event) => {
  pianoService.dispatchEvent(event);
});
presetService.setConnectionService(connectionService);

// ── Hook singletons (presentation accesses services through hooks only) ──────
setPianoService(pianoService);
setConnectionService(connectionService);
setProfileService(profileService);

// ── Bootstrap ────────────────────────────────────────────────────────────────
// Await the first async storage read, ensure a default profile exists, then
// load the boot/active profile so UI config hydrates from it. Non-audible —
// never touches the piano — so it is safe to run on every launch.
void runBootstrap(
  profileService,
  {
    getBootProfileId: () => useAppSettingsStore.getState().bootProfileId,
    getActiveProfileId: () => useProfilesStore.getState().activeProfileId || null,
    getProfileIds: () => useProfilesStore.getState().profiles.map((p) => p.id),
  },
  webStorage,
)
  .then(() => {
    // 009-settings-preferences: restore the live chord spelling from the now
    // restored accidental preference (Req 6.4).
    syncChordAccidentalsFromStore();
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Profile bootstrap failed:', err);
  });

// 009-settings-preferences: keep the chord service in sync with any
// store-driven accidental change (including a profile switch through the
// Profiles screen). Registered once at module scope to avoid StrictMode
// double-registration (Req 7.1 / 7.3).
subscribeChordAccidentals();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <WebAppShell />
  </StrictMode>,
);

// ── PWA ──────────────────────────────────────────────────────────────────────
// Register the offline-shell service worker and wire the controlled update
// prompt. No-op in dev (SW disabled via devOptions).
registerPwa();
