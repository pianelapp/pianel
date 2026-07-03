// Minimal component render harness on react-dom/client + React 19 `act`.
import * as React from 'react';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

export interface RenderResult {
  container: HTMLElement;
  rerender: (ui: React.ReactElement) => void;
  unmount: () => void;
}

export function render(ui: React.ReactElement): RenderResult {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(ui);
  });
  return {
    container,
    rerender(next: React.ReactElement) {
      act(() => root.render(next));
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Dispatch a click that bubbles (so React's delegated handlers fire). */
export function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
  });
}

/** Dispatch a keydown on window. */
export function keydown(key: string): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true}));
  });
}
