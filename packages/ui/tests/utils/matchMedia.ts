// Controllable `window.matchMedia` fake for theme/media-query hook tests.
type Listener = (e: MediaQueryListEvent) => void;

export interface FakeMatchMedia {
  /** Set the current match state for `(prefers-color-scheme: dark)` and notify. */
  setDark(isDark: boolean): void;
  /** Restore the original (or absent) matchMedia. */
  restore(): void;
}

/**
 * Install a fake `matchMedia` that tracks `(prefers-color-scheme: dark)` and
 * dispatches `change` events when toggled. Any other query reports no match.
 */
export function installMatchMedia(initialDark: boolean): FakeMatchMedia {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = (window as any).matchMedia;
  let dark = initialDark;
  const darkListeners = new Set<Listener>();

  function makeList(query: string) {
    const matches = query.includes('dark') ? dark : false;
    const list = {
      matches,
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: Listener) => {
        if (query.includes('dark')) darkListeners.add(cb);
      },
      removeEventListener: (_: string, cb: Listener) => {
        darkListeners.delete(cb);
      },
      addListener: (cb: Listener) => {
        if (query.includes('dark')) darkListeners.add(cb);
      },
      removeListener: (cb: Listener) => {
        darkListeners.delete(cb);
      },
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
    return list;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string) => makeList(query);

  return {
    setDark(isDark: boolean) {
      dark = isDark;
      const event = {matches: isDark} as MediaQueryListEvent;
      darkListeners.forEach(cb => cb(event));
    },
    restore() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).matchMedia = original;
    },
  };
}

/** Remove `matchMedia` entirely to exercise the undeterminable fallback. */
export function removeMatchMedia(): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = (window as any).matchMedia;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).matchMedia;
  return () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).matchMedia = original;
  };
}

/** Make `matchMedia` throw to exercise the undeterminable fallback. */
export function throwingMatchMedia(): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = (window as any).matchMedia;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = () => {
    throw new Error('matchMedia unavailable');
  };
  return () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).matchMedia = original;
  };
}
