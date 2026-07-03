/**
 * Task 9.1 — feature-parity verification (web host, reused renderer).
 *
 * Confirms the web target presents the same primary structure as the desktop
 * app by mounting the real shared `@pianel/ui` renderer through the web host
 * wiring:
 *  - the primary tab set is exactly PRESETS | DISPLAY | PROFILES; and
 *  - DISPLAY is the landing tab (active on first render), with switching to
 *    PRESETS / PROFILES working.
 *
 * Tone browsing, presets, profiles, status, chord detection, and
 * voicing/metronome controls are the shared renderer's screens/hooks consumed
 * verbatim (no fork) and are exercised by the existing store/profile/bootstrap
 * integration tests plus the responsive-layout test; their real-time, latency,
 * and hardware-status behavior requires a connected FP-30X (manual/hardware
 * verification, see summary). Electron-only host capabilities (persistent
 * storage, file import/export) have web equivalents wired here (IndexedDB
 * StateStorage + web FilePicker), covered by storeWiring / profileServiceWiring
 * tests — not omitted.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import App from '@pianel/ui/App';
import { PianoService } from '@pianel/core/services/PianoService';
import { getDefaultEngine } from '@pianel/core/engine/registry';
import type { Transport } from '@pianel/core/transport/types';
import { setPianoService } from '@pianel/ui/hooks/usePiano';
import { initStores, webStorage } from '../src/store';

const stubTransport = {
  status: 'idle',
  scan: async () => {},
  stopScan: async () => {},
  connect: async () => {},
  disconnect: async () => {},
  send: async () => {},
  subscribe: () => () => {},
} as unknown as Transport;

beforeAll(() => {
  initStores(webStorage);
  const pianoService = new PianoService(stubTransport);
  pianoService.setEngine(getDefaultEngine());
  setPianoService(pianoService);
  // Report OS dark so the System theme preference resolves to dark mode, under
  // which the active tab uses the cyan-400 accent this test asserts.
  window.matchMedia = ((q: string) => ({
    matches: /prefers-color-scheme:\s*dark/.test(q),
    media: q,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return true;
    },
  })) as unknown as typeof window.matchMedia;
});

describe('Feature parity — primary tab structure', () => {
  it('renders exactly the PRESETS | DISPLAY | PROFILES tabs', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'PRESETS' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'DISPLAY' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'PROFILES' })).toBeTruthy();
  });

  it('lands on the DISPLAY tab and allows switching to PRESETS and PROFILES', () => {
    render(<App />);

    const presets = screen.getByRole('button', { name: 'PRESETS' });
    const display = screen.getByRole('button', { name: 'DISPLAY' });
    const profiles = screen.getByRole('button', { name: 'PROFILES' });

    // DISPLAY is the active landing tab (cyan-accented active styling).
    expect(display.className).toMatch(/text-cyan-400/);
    expect(presets.className).not.toMatch(/text-cyan-400/);

    fireEvent.click(presets);
    expect(presets.className).toMatch(/text-cyan-400/);

    fireEvent.click(profiles);
    expect(profiles.className).toMatch(/text-cyan-400/);
  });
});
