/// <reference lib="webworker" />
/**
 * Custom service worker (Task 8.2 / 8.3) — injectManifest mode.
 *
 * Offline-shell strategy for the Pianel web PWA:
 *  - Precache the full app shell injected by vite-plugin-pwa
 *    (`self.__WB_MANIFEST`): HTML, hashed JS/CSS, the Orbitron font, every icon
 *    size, and any bundled static JSON. Because the app makes no runtime network
 *    calls for core functionality, the precache alone is the entire offline
 *    surface — no runtime caching strategies are registered.
 *  - Serve an SPA navigation fallback to the precached `index.html` so an
 *    offline cold launch renders the full UI with zero network requests.
 *  - Controlled update path: the SW waits by default; on an explicit
 *    `SKIP_WAITING` message (sent by the prompt-based registration when the user
 *    accepts the update) it activates and claims clients so the reload lands on
 *    a single, consistent version (no mixed-version state).
 *
 * MIDI connectivity is an OS-local capability (Web MIDI) and is unaffected by
 * the SW / network state, so it keeps working offline.
 */
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Precache the full app shell (revision-hashed, idempotent across installs).
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback: any navigation request resolves to the cached
// index.html so offline launches render the shell with no network.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Controlled, atomic update: stay waiting until the page asks us to take over.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('activate', () => {
  // Claim open clients so the freshly activated version controls them
  // immediately after the prompted reload.
  void self.clients.claim();
});
