import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { WebMIDITransport } from '@pianel/ui/transport/WebMIDITransport';
import { requestMIDIDeviceSelection } from '@pianel/ui/components/MIDIDeviceChooser';
import { ConnectionService } from '@pianel/core/services/ConnectionService';
import { PianoService } from '@pianel/core/services/PianoService';
import { PresetService } from '@pianel/core/services/presets/PresetService';
import { ProfileService } from '@pianel/core/services/profiles/ProfileService';
import { SongService } from '@pianel/core/services/songs/SongService';
import { SetlistService } from '@pianel/core/services/setlists/SetlistService';
import { SetlistCursorService } from '@pianel/core/services/cursor/SetlistCursorService';
import { initStores, useAppSettingsStore, useProfilesStore } from '@pianel/ui/store';
import { setPianoService } from '@pianel/ui/hooks/usePiano';
import { setConnectionService } from '@pianel/ui/hooks/useConnection';
import { setProfileService } from '@pianel/ui/hooks/useProfiles';
import { setSongService } from '@pianel/ui/hooks/useSongs';
import { setSetlistService } from '@pianel/ui/hooks/useSetlists';
import { setCursorService } from '@pianel/ui/hooks/usePerformCursor';
import { WebMIDIInputTransport } from '@pianel/ui/transport/WebMIDIInputTransport';
import { ControlSurfaceService } from '@pianel/core/services/control/ControlSurfaceService';
import { getControlActionRegistry } from '@pianel/core/services/control/registry';
import { setControlSurfaceService } from '@pianel/ui/hooks/useControlSurface';
import {
  syncChordAccidentalsFromStore,
  subscribeChordAccidentals,
} from '@pianel/ui/host/chordAccidentalSync';
import { electronStorage } from './store/electronStorage';
import { desktopFilePicker } from './services/filePicker.desktop';
import App from '@pianel/ui/App';
import '@pianel/ui/styles/global.css';

// Bind the shared domain stores to the Electron storage substrate before any
// store is read or the app renders.
initStores(electronStorage);

const transport = new WebMIDITransport();
WebMIDITransport.chooser = requestMIDIDeviceSelection;
const pianoService = new PianoService(transport);
const connectionService = new ConnectionService(transport);
const presetService = new PresetService(pianoService);
const profileService = new ProfileService(
  pianoService,
  desktopFilePicker,
  presetService,
);
const songService = new SongService(presetService);
const setlistService = new SetlistService(songService);
const cursorService = new SetlistCursorService(songService, setlistService, presetService);

connectionService.setPianoService(pianoService);
connectionService.setNotificationHandler(event => {
  pianoService.dispatchEvent(event);
});
presetService.setConnectionService(connectionService);

setPianoService(pianoService);
setConnectionService(connectionService);
setProfileService(profileService);
setSongService(songService);
setSetlistService(setlistService);
setCursorService(cursorService);

const controlInputTransport = new WebMIDIInputTransport();
const controlSurfaceService = new ControlSurfaceService(
  controlInputTransport,
  getControlActionRegistry(),
);
setControlSurfaceService(controlSurfaceService);

// Bootstrap: ensure a default profile exists, then load the boot profile
// so UI config (favorites, theme, accidentals, quick-tone slots, active
// preset list) hydrates from it. Profile load is intentionally non-audible
// — it never touches the piano — so it's safe to run on every launch.
(async () => {
  try {
    await profileService.ensureDefaultProfile();
    const {bootProfileId} = useAppSettingsStore.getState();
    const {activeProfileId, profiles} = useProfilesStore.getState();
    const candidateId = bootProfileId ?? activeProfileId;
    const target = profiles.find(p => p.id === candidateId);
    if (target) {
      await profileService.loadProfile(target.id);
    }
    // 009-settings-preferences: restore the live chord spelling from the now
    // restored accidental preference (Req 6.4).
    syncChordAccidentalsFromStore();
    void controlSurfaceService.restore();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Profile bootstrap failed:', err);
  }
})();

// 009-settings-preferences: keep the chord service in sync with any
// store-driven accidental change (including a profile switch through the
// Profiles screen). Registered once at module scope to avoid StrictMode
// double-registration (Req 7.1 / 7.3).
subscribeChordAccidentals();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
