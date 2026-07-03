// Jest setup for the web workspace.
// `fake-indexeddb/auto` installs a spec-compliant in-memory IndexedDB into the
// jsdom global, so the IndexedDB-backed storage adapter and store-wiring
// integration tests run without a real browser.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';

// jsdom's test environment does not expose Node's global `structuredClone`,
// which fake-indexeddb uses to serialize stored values. Bridge it from the
// Node realm so IndexedDB writes commit correctly in tests.
if (typeof globalThis.structuredClone !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const v8 = require('node:v8');
  globalThis.structuredClone = <T>(value: T): T =>
    v8.deserialize(v8.serialize(value)) as T;
}

// jsdom does not implement ResizeObserver or Element.scrollTo, both of which
// the reused shared renderer touches when rendered in full (integration tests).
// Provide inert polyfills so the real component tree mounts under jsdom.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {};
}
