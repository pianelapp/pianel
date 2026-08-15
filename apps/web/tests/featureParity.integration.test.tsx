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
  it('renders exactly the PRESETS | DISPLAY | SETLISTS | PROFILES tabs', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'PRESETS' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'DISPLAY' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'SETLISTS' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'PROFILES' })).toBeTruthy();
  });

  it('lands on the DISPLAY tab and allows switching to PRESETS, SETLISTS and PROFILES', () => {
    render(<App />);

    const presets = screen.getByRole('button', { name: 'PRESETS' });
    const display = screen.getByRole('button', { name: 'DISPLAY' });
    const setlists = screen.getByRole('button', { name: 'SETLISTS' });
    const profiles = screen.getByRole('button', { name: 'PROFILES' });

    // DISPLAY is the active landing tab (cyan-accented active styling).
    expect(display.className).toMatch(/text-cyan-400/);
    expect(presets.className).not.toMatch(/text-cyan-400/);

    fireEvent.click(presets);
    expect(presets.className).toMatch(/text-cyan-400/);

    fireEvent.click(setlists);
    expect(setlists.className).toMatch(/text-cyan-400/);

    fireEvent.click(profiles);
    expect(profiles.className).toMatch(/text-cyan-400/);
  });
});
