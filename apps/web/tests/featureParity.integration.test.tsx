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

describe('Feature parity — Master Volume panel', () => {
  it('opens from the StatusBar with Engine Volume left and Output Volume right', () => {
    render(<App />);
    const trigger = screen.getAllByRole('button', { name: 'Master Volume' })[0];
    fireEvent.click(trigger);
    const panel = screen.getByRole('dialog', { name: 'Master Volume' });
    const faders = Array.from(
      panel.querySelectorAll('input[type="range"]'),
    ).map((input) => input.getAttribute('aria-label'));
    expect(faders).toEqual(['Engine Volume', 'Output Volume']);
    expect(panel.textContent).not.toMatch(/dB/);
    const buttons = Array.from(panel.querySelectorAll('button'));
    expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual([
      'Pin Engine Volume',
      'Pin Output Volume',
    ]);
  });

  it('moves Engine Volume from the panel without touching Output Volume', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Master Volume' })[0]);
    const panel = screen.getByRole('dialog', { name: 'Master Volume' });
    const engine = panel.querySelector(
      'input[aria-label="Engine Volume"]',
    ) as HTMLInputElement;
    const output = panel.querySelector(
      'input[aria-label="Output Volume"]',
    ) as HTMLInputElement;
    const outputBefore = output.value;
    fireEvent.keyDown(engine, { key: 'PageDown' });
    expect(engine.value).toBe('90');
    expect(
      panel.querySelector('[data-strip="engine"] [data-readout]')?.textContent,
    ).toBe('90');
    expect(output.value).toBe(outputBefore);
  });
});
