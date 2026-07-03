/**
 * Task 6.2 — failing tests for connect-time MIDI permission / error mapping
 * (web host only).
 *
 * The web host wraps the reused `WebMIDITransport` so that the browser's
 * `requestMIDIAccess({ sysex: true })` errors are normalized into actionable,
 * user-facing copy before they reach the (reused, unmodified) desktop
 * `useConnection` error reporter:
 *
 *  - permission denied / blocked (`SecurityError` / `NotAllowedError`)
 *      → "re-enable MIDI in browser settings" guidance.
 *  - no MIDI device available
 *      → "connect via USB / pair via OS Bluetooth, then retry" guidance.
 *
 * These tests pin the pure mapping function. Core and the desktop renderer are
 * never modified.
 */
import {
  mapWebConnectError,
  PERMISSION_DENIED_TITLE,
  NO_DEVICE_TITLE,
} from '../src/host/connectionErrors';

function domException(name: string, message = ''): DOMException {
  // jsdom provides DOMException; fall back to a shaped object otherwise.
  if (typeof DOMException === 'function') {
    return new DOMException(message, name);
  }
  const e = new Error(message) as Error & { name: string };
  e.name = name;
  return e as unknown as DOMException;
}

describe('mapWebConnectError (web host connection-error mapping)', () => {
  it('maps a SecurityError to actionable "re-enable MIDI in browser settings" copy', () => {
    const mapped = mapWebConnectError(
      domException('SecurityError', 'Permission denied'),
    );
    expect(mapped).not.toBeNull();
    expect(mapped?.title).toBe(PERMISSION_DENIED_TITLE);
    expect(mapped?.variant).toBe('warning');
    expect(mapped?.message.toLowerCase()).toContain('browser settings');
    expect(mapped?.message.toLowerCase()).toContain('midi');
  });

  it('maps a NotAllowedError to the same re-enable-MIDI guidance', () => {
    const mapped = mapWebConnectError(
      domException('NotAllowedError', 'The request is not allowed'),
    );
    expect(mapped?.title).toBe(PERMISSION_DENIED_TITLE);
    expect(mapped?.message.toLowerCase()).toContain('browser settings');
  });

  it('maps a generic permission-blocked Error message to re-enable-MIDI guidance', () => {
    const mapped = mapWebConnectError(
      new Error('Web MIDI permission was blocked by the browser'),
    );
    expect(mapped?.title).toBe(PERMISSION_DENIED_TITLE);
  });

  it('maps the no-device condition to "connect via USB / pair via OS Bluetooth, then retry" copy', () => {
    const mapped = mapWebConnectError(
      new Error('No MIDI devices found. Connect your piano and retry.'),
    );
    expect(mapped).not.toBeNull();
    expect(mapped?.title).toBe(NO_DEVICE_TITLE);
    expect(mapped?.message.toLowerCase()).toContain('usb');
    expect(mapped?.message.toLowerCase()).toContain('bluetooth');
    expect(mapped?.message.toLowerCase()).toContain('retry');
  });

  it('returns null for an unrecognized error so the default reporter handles it', () => {
    const mapped = mapWebConnectError(new Error('Some unrelated failure'));
    expect(mapped).toBeNull();
  });
});
