import * as React from 'react';
import {usePerformanceStore} from '@pianel/core/store';
import {act} from 'react';
import {render, click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {StatusBar} from '../../src/screens/display/StatusBar';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  act(() => {
    usePerformanceStore.setState({keyTouch: undefined});
  });
});

function keyTouchButton(root: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(b =>
    (b.getAttribute('aria-label') ?? '').startsWith('Key touch'),
  );
}

function setKeyTouch(level: number): void {
  act(() => {
    usePerformanceStore.setState({keyTouch: level});
  });
}

describe('StatusBar key touch control', () => {
  it('shows a placeholder until the piano reports a curve', () => {
    const {container, unmount} = render(<StatusBar isLightMode />);
    const btn = keyTouchButton(container);
    expect(btn).toBeDefined();
    expect((btn!.textContent ?? '').trim()).toBe('—');
    expect(btn!.getAttribute('aria-label')).toBe('Key touch');
    unmount();
  });

  it('shows the abbreviated curve once the piano reports one', () => {
    const {container, unmount} = render(<StatusBar isLightMode />);
    setKeyTouch(4);
    expect((keyTouchButton(container)!.textContent ?? '').trim()).toBe('HVY');
    unmount();
  });

  it('names the full curve for screen readers', () => {
    const {container, unmount} = render(<StatusBar isLightMode />);
    setKeyTouch(1);
    expect(keyTouchButton(container)!.getAttribute('aria-label')).toBe(
      'Key touch: Super Light',
    );
    unmount();
  });

  it('renders icon-only in compact mode but keeps its accessible name', () => {
    const {container, unmount} = render(<StatusBar isLightMode compact />);
    setKeyTouch(3);
    const btn = keyTouchButton(container);
    expect(btn!.querySelector('svg')).not.toBeNull();
    expect((btn!.textContent ?? '').trim()).toBe('');
    expect(btn!.getAttribute('aria-label')).toBe('Key touch: Medium');
    unmount();
  });

  it('opens the key touch modal listing all six curves', () => {
    const {container, unmount} = render(<StatusBar isLightMode />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    click(keyTouchButton(container) as Element);

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const text = dialog!.textContent ?? '';
    for (const label of [
      'Fix',
      'Super Light',
      'Light',
      'Medium',
      'Heavy',
      'Super Heavy',
    ]) {
      expect(text).toContain(label);
    }
    unmount();
  });

  it('writes the chosen curve to the store, updating the chip', () => {
    const {container, unmount} = render(<StatusBar isLightMode />);
    click(keyTouchButton(container) as Element);

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const heavy = Array.from(dialog.querySelectorAll('button')).find(
      b => (b.textContent ?? '').startsWith('Super Heavy'),
    );
    click(heavy as Element);

    expect(usePerformanceStore.getState().keyTouch).toBe(5);
    expect((keyTouchButton(container)!.textContent ?? '').trim()).toBe('S.HV');
    unmount();
  });

  it('marks the active curve as pressed', () => {
    const {container, unmount} = render(<StatusBar isLightMode />);
    setKeyTouch(2);
    click(keyTouchButton(container) as Element);

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const pressed = Array.from(dialog.querySelectorAll('button')).filter(
      b => b.getAttribute('aria-pressed') === 'true',
    );
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toContain('Light');
    unmount();
  });
});
