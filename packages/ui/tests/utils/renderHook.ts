// Minimal `renderHook` / `render` built on react-dom/client + React 19 `act`,
// so the UI package does not need @testing-library/react.
import * as React from 'react';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';

// React 19 logs a warning unless this flag is set when using `act` outside the
// testing-library wrapper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

export interface HookHarness<T> {
  /** Latest value returned by the hook. */
  readonly current: T;
  /** Re-render the host component (optionally with new props). */
  rerender: () => void;
  /** Unmount and clean up the DOM container. */
  unmount: () => void;
}

export function renderHook<T>(useHook: () => T): HookHarness<T> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const result: {current: T} = {current: undefined as unknown as T};

  function Probe() {
    result.current = useHook();
    return null;
  }

  act(() => {
    root = createRoot(container);
    root.render(React.createElement(Probe));
  });

  return {
    get current() {
      return result.current;
    },
    rerender() {
      act(() => {
        root.render(React.createElement(Probe));
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** Run a state-mutating callback inside `act` so React flushes effects. */
export function actSync(fn: () => void): void {
  act(() => {
    fn();
  });
}
