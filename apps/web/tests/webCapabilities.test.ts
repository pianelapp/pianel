/**
 * Task 4.1 — failing tests for browser capability + secure-context detection.
 *
 * Covers correct flags for present vs. absent Web MIDI support and for secure
 * vs. non-secure context, and asserts detection is pure and side-effect-free:
 * a synchronous snapshot that never triggers the MIDI permission prompt.
 */
import { detectWebCapabilities } from '../src/host/webCapabilities';

describe('detectWebCapabilities', () => {
  const realRequestMIDIAccess = (navigator as unknown as Record<string, unknown>)
    .requestMIDIAccess;
  const realIsSecure = window.isSecureContext;

  afterEach(() => {
    if (realRequestMIDIAccess === undefined) {
      delete (navigator as unknown as Record<string, unknown>).requestMIDIAccess;
    } else {
      (navigator as unknown as Record<string, unknown>).requestMIDIAccess =
        realRequestMIDIAccess;
    }
    Object.defineProperty(window, 'isSecureContext', {
      value: realIsSecure,
      configurable: true,
    });
  });

  function setSecureContext(value: boolean) {
    Object.defineProperty(window, 'isSecureContext', {
      value,
      configurable: true,
    });
  }

  it('reports webMidiAvailable=true when navigator.requestMIDIAccess is present', () => {
    (navigator as unknown as Record<string, unknown>).requestMIDIAccess = () =>
      Promise.resolve();
    setSecureContext(true);

    const caps = detectWebCapabilities();
    expect(caps.webMidiAvailable).toBe(true);
    expect(caps.secureContext).toBe(true);
  });

  it('reports webMidiAvailable=false when navigator.requestMIDIAccess is absent', () => {
    delete (navigator as unknown as Record<string, unknown>).requestMIDIAccess;
    setSecureContext(true);

    const caps = detectWebCapabilities();
    expect(caps.webMidiAvailable).toBe(false);
    expect(caps.secureContext).toBe(true);
  });

  it('reports secureContext=false when window.isSecureContext is false', () => {
    (navigator as unknown as Record<string, unknown>).requestMIDIAccess = () =>
      Promise.resolve();
    setSecureContext(false);

    const caps = detectWebCapabilities();
    expect(caps.webMidiAvailable).toBe(true);
    expect(caps.secureContext).toBe(false);
  });

  it('is pure and never triggers the MIDI permission prompt during detection', () => {
    const requestMIDIAccess = jest.fn(() => Promise.resolve());
    (navigator as unknown as Record<string, unknown>).requestMIDIAccess =
      requestMIDIAccess;
    setSecureContext(true);

    detectWebCapabilities();
    detectWebCapabilities();

    expect(requestMIDIAccess).not.toHaveBeenCalled();
  });
});
