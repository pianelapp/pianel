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

// --- Width-aware fake for breakpoint/tier hook tests ---------------------

interface WidthCondition {
  maxWidth?: number;
  minWidth?: number;
}

interface ViewportList {
  cond: WidthCondition;
  media: string;
  listeners: Set<Listener>;
}

function parseWidthQuery(query: string): WidthCondition {
  const cond: WidthCondition = {};
  const max = query.match(/max-width:\s*([\d.]+)px/);
  const min = query.match(/min-width:\s*([\d.]+)px/);
  if (max) cond.maxWidth = parseFloat(max[1]);
  if (min) cond.minWidth = parseFloat(min[1]);
  return cond;
}

function evaluateWidth(cond: WidthCondition, width: number): boolean {
  if (cond.maxWidth === undefined && cond.minWidth === undefined) return false;
  if (cond.maxWidth !== undefined && width > cond.maxWidth) return false;
  if (cond.minWidth !== undefined && width < cond.minWidth) return false;
  return true;
}

export interface FakeViewport {
  /** Set the current viewport width (px) and notify every registered list. */
  setWidth(px: number): void;
  /** Restore the original (or absent) matchMedia. */
  restore(): void;
}

/**
 * Install a fake `matchMedia` that evaluates `(max-width: Npx)` /
 * `(min-width: Npx)` (and combined `... and ...`) queries against a mutable
 * viewport width. Any non-width query (e.g. the dark-scheme query) reports no
 * match so shared code never crashes. `setWidth` recomputes each list's
 * `matches` and dispatches a `change` event to that list's listeners,
 * mirroring the dark-query mechanics above and supporting both
 * `addEventListener('change', cb)` and the legacy `addListener(cb)`.
 */
export function installViewport(initialWidthPx: number): FakeViewport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = (window as any).matchMedia;
  let width = initialWidthPx;
  const lists = new Set<ViewportList>();

  function makeList(query: string) {
    const cond = parseWidthQuery(query);
    const listeners = new Set<Listener>();
    lists.add({cond, media: query, listeners});
    const list = {
      get matches() {
        return evaluateWidth(cond, width);
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: Listener) => {
        listeners.add(cb);
      },
      removeEventListener: (_: string, cb: Listener) => {
        listeners.delete(cb);
      },
      addListener: (cb: Listener) => {
        listeners.add(cb);
      },
      removeListener: (cb: Listener) => {
        listeners.delete(cb);
      },
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
    return list;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string) => makeList(query);

  return {
    setWidth(px: number) {
      width = px;
      lists.forEach(entry => {
        const matches = evaluateWidth(entry.cond, width);
        const event = {matches, media: entry.media} as MediaQueryListEvent;
        entry.listeners.forEach(cb => cb(event));
      });
    },
    restore() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).matchMedia = original;
    },
  };
}
