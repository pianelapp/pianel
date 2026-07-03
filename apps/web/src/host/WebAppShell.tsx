/**
 * Web app shell (Task 5.1).
 *
 * Wraps the reused desktop `App` for the browser host. Responsibilities:
 *  - Mount the reused desktop `App`/screens verbatim (no fork).
 *  - Strip the Electron-only macOS titlebar-drag chrome and apply
 *    viewport/touch configuration via `webShell.css` (imported by the entry).
 *  - Use capability detection to gate the connect affordance: when Web MIDI is
 *    unavailable or the context is non-secure, surface `WebUnsupportedNotice`
 *    with actionable guidance.
 *  - Keep read-only features (tone library, saved profiles/presets) mounted at
 *    all times — the notice is a non-blocking overlay banner, never a gate on
 *    rendering (Req 3.2).
 *
 * The shared `App` always renders the connection affordance; capability gating
 * is communicated through the notice, and any actual connect attempt in an
 * incapable context is mapped to actionable copy by the web transport wrapper /
 * connection-error mapping (Tasks 6.2/6.3).
 */
import App from '@pianel/ui/App';
import { useAppSettingsStore } from '../store';
import {
  detectWebCapabilities,
  isConnectionCapable,
  type WebCapabilities,
} from './webCapabilities';
import { WebUnsupportedNotice } from './WebUnsupportedNotice';

export interface WebAppShellProps {
  /**
   * Capability snapshot. Defaults to a fresh `detectWebCapabilities()` call;
   * injectable for tests. Detection is pure and never triggers the MIDI prompt.
   */
  capabilities?: WebCapabilities;
}

export function WebAppShell({ capabilities }: WebAppShellProps) {
  const caps = capabilities ?? detectWebCapabilities();
  const themePreference = useAppSettingsStore((s) => s.themePreference);
  const isLightMode = themePreference === 'light';

  return (
    <>
      {/* Reused desktop renderer — read-only features stay mounted regardless
          of connectivity. */}
      <App />

      {/* Connect-affordance gating: a non-blocking banner shown only when the
          browser cannot connect (no Web MIDI and/or non-secure context). */}
      {!isConnectionCapable(caps) && (
        <div className="fixed inset-x-0 bottom-0 z-[60] pb-[env(safe-area-inset-bottom)]">
          <WebUnsupportedNotice
            capabilities={caps}
            isLightMode={isLightMode}
          />
        </div>
      )}
    </>
  );
}
