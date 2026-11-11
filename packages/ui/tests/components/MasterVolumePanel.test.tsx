import * as React from 'react';
import {act, useState} from 'react';
import {useEngineVolumeStore, usePerformanceStore} from '@pianel/core/store';
import type {PianoService} from '@pianel/core/services/PianoService';
import {render, click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {setPianoService} from '../../src/hooks/usePiano';
import {
  MasterVolumePanel,
  MASTER_VOLUME_MARKS,
  MASTER_VOLUME_PANEL_PLACEMENT,
  MASTER_VOLUME_FADER_HEIGHT,
} from '../../src/components/MasterVolumePanel';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  setPianoService(null as unknown as PianoService);
  useEngineVolumeStore.getState().reset();
  usePerformanceStore.getState().setOutputVolume(80);
  useEngineVolumeStore.getState().setPosition(70);
});

function Harness({
  isLightMode = true,
  initialOpen = true,
  onOpenChange,
}: {
  isLightMode?: boolean;
  initialOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div>
      <button type="button" data-testid="outside">
        Outside
      </button>
      <MasterVolumePanel
        open={open}
        onOpenChange={next => {
          onOpenChange?.(next);
          setOpen(next);
        }}
        isLightMode={isLightMode}
        trigger={
          <button type="button" aria-label="Master Volume">
            trigger
          </button>
        }
      />
    </div>
  );
}

function panel(): HTMLElement | null {
  return document.querySelector(
    '[role="dialog"][aria-label="Master Volume"]',
  ) as HTMLElement | null;
}

function sliders(): HTMLInputElement[] {
  return Array.from(
    panel()!.querySelectorAll('input[type="range"]'),
  ) as HTMLInputElement[];
}

function strip(name: 'engine' | 'output'): HTMLElement {
  return panel()!.querySelector(`[data-strip="${name}"]`) as HTMLElement;
}

function readout(name: 'engine' | 'output'): HTMLElement {
  return strip(name).querySelector('[data-readout]') as HTMLElement;
}

function pin(name: 'engine' | 'output'): HTMLButtonElement {
  return strip(name).querySelector('[data-pin]') as HTMLButtonElement;
}

function pressOutside(container: HTMLElement): void {
  const outside = container.querySelector('[data-testid="outside"]')!;
  act(() => {
    outside.dispatchEvent(
      new PointerEvent('pointerdown', {bubbles: true, button: 0}),
    );
    outside.dispatchEvent(new MouseEvent('click', {bubbles: true, button: 0}));
  });
}

function stripNames(): string[] {
  return Array.from(panel()!.querySelectorAll('[data-strip]')).map(
    s => s.getAttribute('data-strip') ?? '',
  );
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe('MasterVolumePanel', () => {
  it('opens a Master Volume dialog panel', () => {
    const {unmount} = render(<Harness />);
    expect(panel()).not.toBeNull();
    unmount();
  });

  it('puts Engine Volume on the left and Output Volume on the right', () => {
    const {unmount} = render(<Harness />);
    const names = sliders().map(s => s.getAttribute('aria-label'));
    expect(names).toEqual(['Engine Volume', 'Output Volume']);
    const strips = Array.from(panel()!.querySelectorAll('[data-strip]')).map(
      s => s.getAttribute('data-strip'),
    );
    expect(strips).toEqual(['engine', 'output']);
    unmount();
  });

  it('shows short strip names with the full names as titles', () => {
    const {unmount} = render(<Harness />);
    const engineName = strip('engine').querySelector('[data-strip-name]')!;
    const outputName = strip('output').querySelector('[data-strip-name]')!;
    expect(engineName.textContent).toBe('ENGINE');
    expect(engineName.getAttribute('title')).toBe('Engine Volume');
    expect(outputName.textContent).toBe('OUTPUT');
    expect(outputName.getAttribute('title')).toBe('Output Volume');
    unmount();
  });

  it('shows plain 0-100 readouts and no dB anywhere', () => {
    const {unmount} = render(<Harness />);
    expect(readout('engine').textContent).toBe('70');
    expect(readout('output').textContent).toBe('80');
    expect(panel()!.textContent).not.toMatch(/dB|∞|%/);
    for (const s of sliders()) {
      const text = s.getAttribute('aria-valuetext');
      expect(text === null || text === s.value).toBe(true);
    }
    unmount();
  });

  it('draws the 0, 25, 50, 75, 100 scale labelled at 0 and 100 on both faders', () => {
    const {unmount} = render(<Harness />);
    expect(MASTER_VOLUME_MARKS).toEqual([
      {value: 0, label: '0'},
      25,
      50,
      75,
      {value: 100, label: '100'},
    ]);
    for (const name of ['engine', 'output'] as const) {
      const scale = strip(name).querySelector('[data-slot="fader-scale"]')!;
      expect(scale.children).toHaveLength(5);
      expect(scale.textContent).toBe('0100');
    }
    unmount();
  });

  it('renders no close button and no captions', () => {
    const {unmount} = render(<Harness />);
    const buttons = Array.from(panel()!.querySelectorAll('button'));
    expect(buttons.every(b => b.hasAttribute('data-pin'))).toBe(true);
    expect(panel()!.textContent).not.toMatch(/close|USB|Speakers/i);
    unmount();
  });

  it('places the value below the fader in the regular sans font', () => {
    const {unmount} = render(<Harness />);
    for (const name of ['engine', 'output'] as const) {
      const children = Array.from(strip(name).children);
      const faderIndex = children.findIndex(c =>
        c.classList.contains('pianel-fader'),
      );
      const readoutIndex = children.indexOf(readout(name));
      expect(readoutIndex).toBeGreaterThan(faderIndex);
      expect(readout(name).className).toContain('font-sans');
      expect(readout(name).className).not.toMatch(/font-mono|font-orbitron/);
    }
    unmount();
  });

  it('gives each fader its own pin, off by default', () => {
    const {unmount} = render(<Harness />);
    expect(pin('engine').getAttribute('aria-label')).toBe('Pin Engine Volume');
    expect(pin('output').getAttribute('aria-label')).toBe('Pin Output Volume');
    expect(pin('engine').getAttribute('aria-pressed')).toBe('false');
    expect(pin('output').getAttribute('aria-pressed')).toBe('false');
    click(pin('engine'));
    expect(pin('engine').getAttribute('aria-pressed')).toBe('true');
    expect(pin('engine').className).toContain('text-cyan-500');
    expect(pin('output').className).not.toContain('text-cyan-500');
    click(pin('engine'));
    expect(pin('engine').getAttribute('aria-pressed')).toBe('false');
    unmount();
  });

  it('keeps only the pinned fader on screen after a press outside', async () => {
    const onOpenChange = jest.fn();
    const {container, unmount} = render(<Harness onOpenChange={onOpenChange} />);
    await flush();
    click(pin('output'));
    pressOutside(container);
    await flush();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(stripNames()).toEqual(['output']);
    pressOutside(container);
    await flush();
    expect(stripNames()).toEqual(['output']);
    unmount();
  });

  it('keeps both faders on screen when both are pinned', async () => {
    const {container, unmount} = render(<Harness />);
    await flush();
    click(pin('engine'));
    click(pin('output'));
    pressOutside(container);
    await flush();
    expect(stripNames()).toEqual(['engine', 'output']);
    unmount();
  });

  it('keeps pinned faders on screen on Escape', () => {
    const {unmount} = render(<Harness />);
    click(pin('engine'));
    act(() => {
      panel()!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(stripNames()).toEqual(['engine']);
    unmount();
  });

  it('brings back every fader when the trigger is pressed while pinned, then closes on the next press', async () => {
    const onOpenChange = jest.fn();
    const {container, unmount} = render(<Harness onOpenChange={onOpenChange} />);
    await flush();
    click(pin('engine'));
    pressOutside(container);
    await flush();
    const trigger = container.querySelector(
      'button[aria-label="Master Volume"]',
    ) as HTMLButtonElement;
    click(trigger);
    expect(stripNames()).toEqual(['engine', 'output']);
    click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(panel()).toBeNull();
    click(trigger);
    expect(stripNames()).toEqual(['engine', 'output']);
    expect(pin('engine').getAttribute('aria-pressed')).toBe('true');
    unmount();
  });

  it('closes when the last pinned fader left on screen is unpinned', async () => {
    const onOpenChange = jest.fn();
    const {container, unmount} = render(<Harness onOpenChange={onOpenChange} />);
    await flush();
    click(pin('output'));
    pressOutside(container);
    await flush();
    click(pin('output'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(panel()).toBeNull();
    unmount();
  });

  it('closes on Escape and keeps both values', () => {
    const onOpenChange = jest.fn();
    const {unmount} = render(<Harness onOpenChange={onOpenChange} />);
    act(() => {
      panel()!.dispatchEvent(
        new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(panel()).toBeNull();
    expect(usePerformanceStore.getState().outputVolume).toBe(80);
    expect(useEngineVolumeStore.getState().position).toBe(70);
    unmount();
  });

  it('closes on a press outside and keeps both values', async () => {
    const onOpenChange = jest.fn();
    const {container, unmount} = render(
      <Harness onOpenChange={onOpenChange} />,
    );
    await flush();
    const outside = container.querySelector('[data-testid="outside"]')!;
    act(() => {
      outside.dispatchEvent(
        new PointerEvent('pointerdown', {bubbles: true, button: 0}),
      );
      outside.dispatchEvent(new MouseEvent('click', {bubbles: true, button: 0}));
    });
    await flush();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(panel()).toBeNull();
    expect(usePerformanceStore.getState().outputVolume).toBe(80);
    expect(useEngineVolumeStore.getState().position).toBe(70);
    unmount();
  });

  it('anchors above the trigger at the end with a 16px collision padding', () => {
    expect(MASTER_VOLUME_PANEL_PLACEMENT).toEqual({
      side: 'top',
      align: 'end',
      sideOffset: 8,
      collisionPadding: 16,
    });
    const {unmount} = render(<Harness />);
    expect(panel()!.getAttribute('data-side')).toBe('top');
    expect(panel()!.getAttribute('data-align')).toBe('end');
    unmount();
  });

  it('moves the Output fader when the piano reports a new Output Volume', () => {
    const {unmount} = render(<Harness />);
    act(() => {
      usePerformanceStore.getState().setOutputVolume(33);
    });
    expect(sliders()[1].value).toBe('33');
    expect(readout('output').textContent).toBe('33');
    unmount();
  });

  it('updates the Engine readout immediately when its fader moves', () => {
    const {unmount} = render(<Harness />);
    act(() => {
      sliders()[0].dispatchEvent(
        new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}),
      );
    });
    expect(readout('engine').textContent).toBe('69');
    expect(useEngineVolumeStore.getState().position).toBe(69);
    expect(usePerformanceStore.getState().outputVolume).toBe(80);
    unmount();
  });

  it('moves focus into the panel container on open and back to the trigger on close', async () => {
    const {container, unmount} = render(<Harness initialOpen={false} />);
    const trigger = container.querySelector(
      'button[aria-label="Master Volume"]',
    ) as HTMLButtonElement;
    trigger.focus();
    click(trigger);
    expect(panel()).not.toBeNull();
    expect(document.activeElement).toBe(panel());
    act(() => {
      panel()!.dispatchEvent(
        new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}),
      );
    });
    await flush();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    unmount();
  });

  it('disables Engine Volume when the piano does not support it', () => {
    useEngineVolumeStore.getState().setSupported(false);
    const {unmount} = render(<Harness />);
    const [engine, output] = sliders();
    expect(engine.disabled).toBe(true);
    expect(output.disabled).toBe(false);
    const note = strip('engine').querySelector('[data-unavailable]')!;
    expect(note.textContent).toBe('Not available on this piano');
    expect(engine.getAttribute('aria-describedby')).toBe(note.id);
    expect(readout('engine').className).toContain('opacity-40');
    expect(readout('output').className).not.toContain('opacity-40');
    unmount();
  });

  it('makes both faders 60% of the viewport height', () => {
    expect(MASTER_VOLUME_FADER_HEIGHT).toBe('60vh');
    const {unmount} = render(<Harness />);
    for (const name of ['engine', 'output'] as const) {
      const root = strip(name).querySelector('.pianel-fader') as HTMLElement;
      expect(root.style.getPropertyValue('--fader-min-height')).toBe('60vh');
      expect(root.style.height).toBe('60vh');
    }
    unmount();
  });

  it('renders matched strips in the light theme', () => {
    const {unmount} = render(<Harness isLightMode />);
    expect(panel()!.className).toContain('bg-white');
    expect(panel()!.className).toContain('border-zinc-200');
    const roots = panel()!.querySelectorAll('.pianel-fader');
    expect(roots).toHaveLength(2);
    roots.forEach(r => expect(r.classList.contains('dark')).toBe(false));
    expect(strip('engine').className).toBe(strip('output').className);
    unmount();
  });

  it('renders matched strips in the dark theme', () => {
    const {unmount} = render(<Harness isLightMode={false} />);
    expect(panel()!.className).toContain('bg-zinc-900');
    expect(panel()!.className).toContain('border-zinc-800');
    const roots = panel()!.querySelectorAll('.pianel-fader');
    roots.forEach(r => expect(r.classList.contains('dark')).toBe(true));
    unmount();
  });
});
