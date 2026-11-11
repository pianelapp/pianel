import * as React from 'react';
import {act} from 'react';
import {PianoService} from '@pianel/core/services/PianoService';
import {PresetService} from '@pianel/core/services/presets/PresetService';
import {getDefaultEngine} from '@pianel/core/engine/registry';
import {engineVolumeValueForPosition} from '@pianel/core/helpers/engineVolume';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '@pianel/core/store';
import type {Transport} from '@pianel/core/transport/types';
import {
  useConnectionStore,
  useEngineVolumeStore,
  usePerformanceStore,
} from '../../src/store';
import {click, render} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {setPianoService} from '../../src/hooks/usePiano';
import {StatusBar} from '../../src/screens/display/StatusBar';

function recordingTransport(sent: number[][]): Transport {
  return {
    status: 'connected',
    scan: async () => {},
    stopScan: async () => {},
    connect: async () => {},
    disconnect: async () => {},
    send: async (bytes: Uint8Array | number[]) => {
      sent.push(Array.from(bytes));
    },
    subscribe: () => () => {},
  } as unknown as Transport;
}

function engineVolumeMessage(position: number): number[] {
  return [0xf0, 0x7f, 0x7f, 0x04, 0x01, 0x00, engineVolumeValueForPosition(position), 0xf7];
}

function isEngineVolume(bytes: number[]): boolean {
  return bytes.length === 8 && bytes[1] === 0x7f && bytes[3] === 0x04 && bytes[4] === 0x01;
}

function isOutputVolumeWrite(bytes: number[]): boolean {
  for (let i = 0; i + 3 < bytes.length; i++) {
    if (bytes[i] === 0x01 && bytes[i + 1] === 0x00 && bytes[i + 2] === 0x02 && bytes[i + 3] === 0x13) {
      return true;
    }
  }
  return false;
}

function panel(): HTMLElement {
  return document.querySelector('[role="dialog"][aria-label="Master Volume"]') as HTMLElement;
}

function fader(name: 'Engine Volume' | 'Output Volume'): HTMLInputElement {
  return panel().querySelector(`input[aria-label="${name}"]`) as HTMLInputElement;
}

function readout(kind: 'engine' | 'output'): string {
  return panel().querySelector(`[data-strip="${kind}"] [data-readout]`)!.textContent ?? '';
}

function press(el: Element, key: string): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true}));
  });
}

async function wait(ms: number): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, ms));
  });
}

function openPanel(container: HTMLElement): void {
  const trigger = Array.from(container.querySelectorAll('button')).find(
    b => b.getAttribute('aria-label') === 'Master Volume',
  )!;
  click(trigger);
}

let sent: number[][];
let service: PianoService;

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  sent = [];
  service = new PianoService(recordingTransport(sent));
  service.setEngine(getDefaultEngine());
  setPianoService(service);
  act(() => {
    useEngineVolumeStore.getState().reset();
    usePerformanceStore.getState().setOutputVolume(80);
    useConnectionStore.setState({status: 'connected'});
  });
});

afterEach(() => {
  service.handleLinkClosed();
  act(() => {
    useConnectionStore.setState({status: 'disconnected'});
  });
});

describe('Master Volume end to end', () => {
  it('keying the Engine fader updates it at once and sends the Master Volume message', async () => {
    const {container, unmount} = render(<StatusBar isLightMode />);
    openPanel(container);
    press(fader('Engine Volume'), 'PageDown');
    expect(fader('Engine Volume').value).toBe('90');
    expect(readout('engine')).toBe('90');
    expect(useEngineVolumeStore.getState().position).toBe(90);
    await wait(60);
    expect(sent.filter(isEngineVolume)).toEqual([engineVolumeMessage(90)]);
    expect(sent.some(isOutputVolumeWrite)).toBe(false);
    expect(usePerformanceStore.getState().outputVolume).toBe(80);
    unmount();
  });

  it('pressing and dragging the Engine track moves it at once and sends the last position', async () => {
    const {container, unmount} = render(<StatusBar isLightMode />);
    openPanel(container);
    const track = panel().querySelector(
      '[data-strip="engine"] [data-slot="fader-track"]',
    ) as HTMLElement;
    const control = track.parentElement as HTMLElement;
    control.getBoundingClientRect = () =>
      ({top: 0, bottom: 100, left: 0, right: 10, width: 10, height: 100, x: 0, y: 0, toJSON: () => ({})}) as DOMRect;
    const pointer = (type: string, clientY: number, buttons: number) => {
      const e = new MouseEvent(type, {bubbles: true, cancelable: true, clientX: 5, clientY, button: 0, buttons});
      Object.defineProperty(e, 'pointerId', {value: 1});
      Object.defineProperty(e, 'pointerType', {value: 'mouse'});
      return e;
    };
    act(() => {
      track.dispatchEvent(pointer('pointerdown', 25, 1));
    });
    expect(readout('engine')).toBe('75');
    act(() => {
      document.dispatchEvent(pointer('pointermove', 140, 1));
    });
    expect(readout('engine')).toBe('0');
    act(() => {
      document.dispatchEvent(pointer('pointermove', 40, 1));
      document.dispatchEvent(pointer('pointerup', 40, 0));
    });
    expect(readout('engine')).toBe('60');
    expect(useEngineVolumeStore.getState().position).toBe(60);
    await wait(80);
    expect(sent.filter(isEngineVolume).pop()).toEqual(engineVolumeMessage(60));
    unmount();
  });

  it('a burst of Engine changes ends on the last value', async () => {
    const {container, unmount} = render(<StatusBar isLightMode />);
    openPanel(container);
    for (let i = 0; i < 12; i++) press(fader('Engine Volume'), 'ArrowDown');
    expect(readout('engine')).toBe('88');
    await wait(120);
    const engineSends = sent.filter(isEngineVolume);
    expect(engineSends.length).toBeGreaterThan(0);
    expect(engineSends.length).toBeLessThan(12);
    expect(engineSends[engineSends.length - 1]).toEqual(engineVolumeMessage(88));
    unmount();
  });

  it('adjusts Engine Volume offline without sending', async () => {
    act(() => {
      useConnectionStore.setState({status: 'disconnected'});
    });
    const {container, unmount} = render(<StatusBar isLightMode />);
    openPanel(container);
    press(fader('Engine Volume'), 'Home');
    expect(readout('engine')).toBe('0');
    await wait(60);
    expect(sent.filter(isEngineVolume)).toEqual([]);
    unmount();
  });

  it('keying the Output fader writes Output Volume and leaves Engine Volume alone', async () => {
    const {container, unmount} = render(<StatusBar isLightMode />);
    openPanel(container);
    press(fader('Output Volume'), 'ArrowUp');
    expect(readout('output')).toBe('81');
    expect(usePerformanceStore.getState().outputVolume).toBe(81);
    await wait(80);
    expect(sent.some(isOutputVolumeWrite)).toBe(true);
    expect(sent.filter(isEngineVolume)).toEqual([]);
    expect(useEngineVolumeStore.getState().position).toBe(100);
    unmount();
  });

  it('recalling a snapshot moves the open Engine fader and not the Output fader', async () => {
    const presets = new PresetService(service);
    const {container, unmount} = render(<StatusBar isLightMode={false} />);
    openPanel(container);
    await act(async () => {
      await presets.applySnapshot({...DEFAULT_PERFORMANCE_SNAPSHOT, volume: 60});
    });
    expect(readout('engine')).toBe('60');
    expect(fader('Engine Volume').value).toBe('60');
    expect(readout('output')).toBe('80');
    await wait(60);
    expect(sent.filter(isEngineVolume).pop()).toEqual(engineVolumeMessage(60));
    expect(sent.some(isOutputVolumeWrite)).toBe(false);
    unmount();
  });
});
