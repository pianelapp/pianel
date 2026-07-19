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

// jsdom lacks the pointer-capture and scroll APIs Radix Popover touches while
// opening/closing. Provide benign no-op stubs so the dropdown interactions do
// not throw under jsdom.
if (typeof Element !== 'undefined') {
  if (typeof Element.prototype.hasPointerCapture === 'undefined') {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (typeof Element.prototype.setPointerCapture === 'undefined') {
    Element.prototype.setPointerCapture = () => {};
  }
  if (typeof Element.prototype.releasePointerCapture === 'undefined') {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (typeof Element.prototype.scrollIntoView === 'undefined') {
    Element.prototype.scrollIntoView = () => {};
  }
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
