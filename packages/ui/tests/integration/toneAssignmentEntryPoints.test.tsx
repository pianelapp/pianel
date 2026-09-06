import {act} from 'react';
import {click, render} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {menu, menuItems, longPress} from '../utils/longPress';
import {
  useConnectionStore,
  useMidiChannelStore,
  usePerformanceStore,
} from '../../src/store';
import {setPianoService} from '../../src/hooks/usePiano';
import {LibrarySidebar} from '../../src/components/LibrarySidebar';
import {ToneSelector} from '../../src/screens/display/ToneSelector';
import {fp30xToneCatalog} from '@pianel/core/engine/fp30x/tones';
import type {PianoService} from '@pianel/core/services/PianoService';

beforeAll(() => {
  initTestStores();
});

const concertPiano = fp30xToneCatalog.findById('0-0-0')!;
const ballad = fp30xToneCatalog.findById('0-0-1')!;

let changeToneCalls: string[] = [];

function stubPiano(): PianoService {
  return {
    getToneCatalog: () => fp30xToneCatalog,
    getChannelToneTargets: (tone: typeof concertPiano) =>
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(channel => ({
        channel,
        eligible: channel !== 4 && (channel !== 10 || tone.category === 0x07),
        reason: null,
      })),
    assignChannelTone: jest.fn(),
    changeTone: (tone: typeof concertPiano) => {
      changeToneCalls.push(tone.id);
      return Promise.resolve();
    },
  } as unknown as PianoService;
}

function setConnected(connected: boolean): void {
  act(() => {
    useConnectionStore.setState({
      status: connected ? 'connected' : 'disconnected',
      deviceId: connected ? 'piano-a' : null,
      lastConnectedAt: '2026-09-04T00:00:00.000Z',
    });
  });
}

function libraryRow(container: HTMLElement, name: string): Element {
  const span = Array.from(container.querySelectorAll('span')).find(
    s => (s.textContent ?? '').trim() === name,
  );
  if (!span) throw new Error(`row "${name}" not found`);
  const row = span.closest('div.w-full');
  if (!row) throw new Error(`row wrapper for "${name}" not found`);
  return row;
}

function tonePanel(container: HTMLElement): Element {
  const el = container.querySelector('.cursor-pointer');
  if (!el) throw new Error('tone panel not found');
  return el;
}

function contextMenu(el: Element): void {
  act(() => {
    el.dispatchEvent(
      new MouseEvent('contextmenu', {bubbles: true, cancelable: true}),
    );
  });
}

function actionsModalButtons(): string[] {
  const dialog = document.querySelector('[aria-labelledby="tone-actions-title"]');
  if (!dialog) throw new Error('tone actions modal not open');
  return Array.from(dialog.querySelectorAll('button')).map(b =>
    (b.textContent ?? '').trim(),
  );
}

function actionsModalButton(label: string): HTMLButtonElement {
  const dialog = document.querySelector('[aria-labelledby="tone-actions-title"]');
  if (!dialog) throw new Error('tone actions modal not open');
  const btn = Array.from(dialog.querySelectorAll('button')).find(b =>
    (b.textContent ?? '').trim().startsWith(label),
  );
  if (!btn) throw new Error(`button "${label}" not found`);
  return btn as HTMLButtonElement;
}

beforeEach(() => {
  jest.useFakeTimers();
  changeToneCalls = [];
  setPianoService(stubPiano());
  act(() => {
    useMidiChannelStore.getState().reset();
    usePerformanceStore.getState().setActiveTone(concertPiano);
  });
  setConnected(true);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Tone Library entry point', () => {
  it('opens the row menu on a recognized long press without selecting the tone', async () => {
    const {container, unmount} = render(<LibrarySidebar isLightMode={false} />);
    expect(menu()).toBeNull();

    await longPress(libraryRow(container, ballad.name), 120, 140);

    expect(menu()).not.toBeNull();
    expect(menuItems()).toEqual(['Assign to MIDI channel']);
    expect(changeToneCalls).toEqual([]);
    expect(usePerformanceStore.getState().activeTone?.id).toBe(concertPiano.id);
    unmount();
  });

  it('opens the row menu on a pointer secondary click', () => {
    const {container, unmount} = render(<LibrarySidebar isLightMode={false} />);
    contextMenu(libraryRow(container, ballad.name));

    expect(menu()).not.toBeNull();
    expect(changeToneCalls).toEqual([]);
    unmount();
  });

  it('disables the action with the reason while no piano is connected', () => {
    setConnected(false);
    const {container, unmount} = render(<LibrarySidebar isLightMode={false} />);
    contextMenu(libraryRow(container, ballad.name));

    expect(menuItems()).toEqual(['Assign to MIDI channel (piano not connected)']);
    const item = menu()!.querySelector('[role="menuitem"]') as HTMLButtonElement;
    expect(item.disabled).toBe(true);
    unmount();
  });

  it('opens the pick-up list for the row that was pressed', async () => {
    const {container, unmount} = render(<LibrarySidebar isLightMode={false} />);
    await longPress(libraryRow(container, ballad.name), 120, 140);
    // The recognizer arms a one-shot capture guard that swallows the emulated
    // click after a press-and-hold; let it lapse before the deliberate tap.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    click(menu()!.querySelector('[role="menuitem"]')!);

    const dialog = document.querySelector(
      '[aria-labelledby="channel-picker-title"]',
    );
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain(ballad.name);
    unmount();
  });

  it('renders its overlays outside the sidebar subtree', async () => {
    // On mobile the sidebar sits inside a `translate-x-*` drawer, which becomes
    // the containing block for `position: fixed`. Both overlays must escape it.
    const {container, unmount} = render(<LibrarySidebar isLightMode={false} />);
    contextMenu(libraryRow(container, ballad.name));

    const rowMenu = menu()!;
    expect(document.body.contains(rowMenu)).toBe(true);
    expect(container.contains(rowMenu)).toBe(false);

    click(rowMenu.querySelector('[role="menuitem"]')!);
    const dialog = document.querySelector(
      '[aria-labelledby="channel-picker-title"]',
    )!;
    expect(document.body.contains(dialog)).toBe(true);
    expect(container.contains(dialog)).toBe(false);
    unmount();
  });

  it('leaves the primary action on a row unchanged', () => {
    const {container, unmount} = render(<LibrarySidebar isLightMode={false} />);
    const row = libraryRow(container, ballad.name);
    click(row.querySelector('button')!);

    expect(changeToneCalls).toEqual([ballad.id]);
    expect(usePerformanceStore.getState().activeTone?.id).toBe(ballad.id);
    expect(menu()).toBeNull();
    unmount();
  });
});

describe('Current tone display entry point', () => {
  it('offers the action enabled while connected', () => {
    const {container, unmount} = render(<ToneSelector isLightMode={false} />);
    contextMenu(tonePanel(container));

    expect(actionsModalButtons()).toEqual([
      'Add to Favorites',
      'Set as Default',
      'Assign to MIDI channel',
      'MIDI Channel Assignments',
      'Cancel',
    ]);
    expect(actionsModalButton('Assign to MIDI channel').disabled).toBe(false);
    unmount();
  });

  it('disables the action with the reason while no piano is connected', () => {
    setConnected(false);
    const {container, unmount} = render(<ToneSelector isLightMode={false} />);
    contextMenu(tonePanel(container));

    const btn = actionsModalButton('Assign to MIDI channel');
    expect(btn.textContent).toBe('Assign to MIDI channel (piano not connected)');
    expect(btn.disabled).toBe(true);
    unmount();
  });

  it('opens the pick-up list for the active tone', () => {
    const {container, unmount} = render(<ToneSelector isLightMode={false} />);
    contextMenu(tonePanel(container));
    click(actionsModalButton('Assign to MIDI channel'));

    const dialog = document.querySelector(
      '[aria-labelledby="channel-picker-title"]',
    );
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain(concertPiano.name);
    unmount();
  });

  it('offers a read-only assignments view alongside the assign action', () => {
    act(() => {
      useMidiChannelStore.getState().record({
        channel: 6,
        toneId: ballad.id,
        deviceId: 'piano-a',
        connectionMark: '2026-09-04T00:00:00.000Z',
      });
    });

    const {container, unmount} = render(<ToneSelector isLightMode={false} />);
    contextMenu(tonePanel(container));

    expect(actionsModalButtons()).toEqual([
      'Add to Favorites',
      'Set as Default',
      'Assign to MIDI channel',
      'MIDI Channel Assignments',
      'Cancel',
    ]);

    click(actionsModalButton('MIDI Channel Assignments'));

    const dialog = document.querySelector(
      '[aria-labelledby="channel-picker-title"]',
    )!;
    expect(
      dialog.querySelector('#channel-picker-title')!.textContent,
    ).toBe('MIDI channel assignments');
    expect(dialog.textContent).toContain('Ch. 6');
    expect(dialog.textContent).toContain(ballad.name);
    expect(dialog.textContent).not.toContain('Not assigned');
    expect(
      dialog.querySelector('.custom-scrollbar')!.querySelectorAll('button'),
    ).toHaveLength(0);
    unmount();
  });

  it('stays enabled while no piano is connected, since records outlive the link', () => {
    setConnected(false);
    const {container, unmount} = render(<ToneSelector isLightMode={false} />);
    contextMenu(tonePanel(container));

    expect(actionsModalButton('MIDI Channel Assignments').disabled).toBe(false);
    unmount();
  });

  it('leaves the primary stepper actions unchanged', () => {
    const {container, unmount} = render(<ToneSelector isLightMode={false} />);
    const buttons = Array.from(container.querySelectorAll('button'));
    click(buttons[buttons.length - 1]);

    expect(changeToneCalls).toEqual([ballad.id]);
    expect(
      document.querySelector('[aria-labelledby="channel-picker-title"]'),
    ).toBeNull();
    unmount();
  });
});
