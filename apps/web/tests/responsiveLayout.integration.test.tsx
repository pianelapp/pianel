/**
 * Task 7.1 — responsive Library layout + drawer-dismissal verification.
 *
 * Verifies the reused shared `@pianel/ui` renderer, as mounted by the web host,
 * exhibits the required responsive Library behavior on the web target:
 *  - Wide viewport (>= 900px): the Library renders as a persistent left column
 *    (no hamburger toggle present).
 *  - Narrow viewport (< 900px): the Library collapses into a hamburger-toggled
 *    slide-in drawer that is dismissed by (a) backdrop tap, (b) Escape, and
 *    (c) after a tone selection.
 *
 * The test drives `window.matchMedia('(max-width: 900px)')` (jsdom has no real
 * media engine) and exercises the real shared `App` so the verification covers
 * the actual reused component tree, not a mock. Stores are bound to the web
 * IndexedDB adapter via `initStores` exactly as the web entry does.
 */
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import App from '@pianel/ui/App';
import { PianoService } from '@pianel/core/services/PianoService';
import { getDefaultEngine } from '@pianel/core/engine/registry';
import type { Transport } from '@pianel/core/transport/types';
import { setPianoService } from '@pianel/ui/hooks/usePiano';
import { initStores, webStorage } from '../src/store';

/** Inert transport stub — the responsive test never connects to a piano. */
const stubTransport = {
  status: 'idle',
  scan: async () => {},
  stopScan: async () => {},
  connect: async () => {},
  disconnect: async () => {},
  send: async () => {},
  subscribe: () => () => {},
} as unknown as Transport;

/** Install a controllable matchMedia keyed on the narrow-viewport query. */
function setViewport(isNarrow: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  window.matchMedia = ((query: string) => {
    const matches = query.includes('max-width: 900px') ? isNarrow : false;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
        listeners.add(cb),
      removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
        listeners.delete(cb),
      addListener: (cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
      removeListener: (cb: (e: MediaQueryListEvent) => void) =>
        listeners.delete(cb),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

beforeAll(() => {
  initStores(webStorage);
  // Wire a PianoService with the FP-30X engine so the reused Library renders a
  // populated tone catalog (needed to exercise after-tone-select dismissal).
  const pianoService = new PianoService(stubTransport);
  pianoService.setEngine(getDefaultEngine());
  setPianoService(pianoService);
});

describe('Responsive Library layout (web host, reused renderer)', () => {
  it('renders the Library as a persistent left column at wide viewports', () => {
    setViewport(false);
    render(<App />);

    // Library is mounted inline...
    expect(screen.getByText('Library')).toBeTruthy();
    // ...and there is no hamburger toggle at wide viewports.
    expect(screen.queryByRole('button', { name: /open library/i })).toBeNull();
  });

  it('renders a hamburger-toggled slide-in drawer at narrow viewports', () => {
    setViewport(true);
    render(<App />);

    const hamburger = screen.getByRole('button', { name: /open library/i });
    expect(hamburger).toBeTruthy();

    // Drawer dialog exists in the tree but is closed (translated off-canvas)
    // until the hamburger is tapped.
    const drawer = screen.getByRole('dialog', { name: /tone library/i });
    expect(drawer.className).toContain('-translate-x-full');

    fireEvent.click(hamburger);
    expect(drawer.className).toContain('translate-x-0');
  });

  it('dismisses the drawer on backdrop tap', () => {
    setViewport(true);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /open library/i }));
    const drawer = screen.getByRole('dialog', { name: /tone library/i });
    expect(drawer.className).toContain('translate-x-0');

    // The backdrop is the aria-hidden sibling overlay.
    const backdrop = document.querySelector('[aria-hidden]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(drawer.className).toContain('-translate-x-full');
  });

  it('dismisses the drawer on Escape', () => {
    setViewport(true);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /open library/i }));
    const drawer = screen.getByRole('dialog', { name: /tone library/i });
    expect(drawer.className).toContain('translate-x-0');

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(drawer.className).toContain('-translate-x-full');
  });

  it('dismisses the drawer after a tone selection', () => {
    setViewport(true);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /open library/i }));
    const drawer = screen.getByRole('dialog', { name: /tone library/i });
    expect(drawer.className).toContain('translate-x-0');

    // Select the first tone inside the open drawer. Tone-name buttons carry the
    // `flex-col items-start` layout class (distinct from category buttons).
    const firstTone = within(drawer)
      .getAllByRole('button')
      .find((b) => b.className.includes('flex-col items-start'));
    expect(firstTone).toBeTruthy();
    fireEvent.click(firstTone as HTMLElement);

    expect(drawer.className).toContain('-translate-x-full');
  });
});
