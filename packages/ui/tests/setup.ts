// Global jest setup for @pianel/ui tests.
//
// jsdom does not implement `matchMedia`. Individual tests install their own
// controllable fake (see tests/utils/matchMedia.ts); here we only guarantee a
// benign default so importing modules never crashes on load.
// jsdom lacks ResizeObserver (used by useMarquee). Provide a no-op stub.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = ResizeObserverStub;
}

// jsdom lacks PointerEvent; alias it to MouseEvent for gesture tests.
if (typeof globalThis.PointerEvent === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = MouseEvent;
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  // Minimal non-matching stub; overridden per-test where behaviour matters.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
