/**
 * Browser capability + secure-context detection (Task 4.2).
 *
 * Pure, side-effect-free snapshot used to gate the connection UI and drive the
 * unsupported-context notice. Detection MUST NOT call `requestMIDIAccess` (that
 * would trigger the browser's MIDI-SysEx permission prompt); it only checks for
 * the API's presence and the secure-context flag.
 */
export interface WebCapabilities {
  /** `navigator.requestMIDIAccess` is present (Chromium-based browsers). */
  readonly webMidiAvailable: boolean;
  /** The page is served from a secure context (HTTPS or localhost). */
  readonly secureContext: boolean;
}

export function detectWebCapabilities(): WebCapabilities {
  const webMidiAvailable =
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & {
      requestMIDIAccess?: unknown;
    }).requestMIDIAccess === 'function';

  const secureContext =
    typeof window !== 'undefined' && window.isSecureContext === true;

  return { webMidiAvailable, secureContext };
}

/** Connection is only possible with both Web MIDI and a secure context. */
export function isConnectionCapable(caps: WebCapabilities): boolean {
  return caps.webMidiAvailable && caps.secureContext;
}
