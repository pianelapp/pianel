/**
 * PWA service-worker registration + controlled update prompt (Task 8.3).
 *
 * Uses vite-plugin-pwa's `prompt` registration. When a new deployment is
 * detected on a subsequent visit, the freshly installed service worker waits;
 * we surface a "new version available" confirm via the shared alert UI. On
 * accept we apply the update atomically — `updateSW(true)` posts `SKIP_WAITING`
 * to the waiting worker (which then `skipWaiting()` + `clients.claim()`) and
 * reloads the page — so the user is never left on a mixed-version state
 * (Req 6.2, 7.4).
 *
 * In dev (no SW) this is a no-op; the virtual module's `registerSW` simply does
 * nothing when a service worker is not registered.
 */
import { registerSW } from 'virtual:pwa-register';
import { showAlert } from '@pianel/ui/components/modals/AlertModal';

export function registerPwa(): void {
  // `updateSW(true)` triggers skip-waiting + reload.
  const updateSW = registerSW({
    onNeedRefresh() {
      void showAlert({
        variant: 'info',
        title: 'Update available',
        message:
          'A new version of Pianel is ready. Reload now to use it?',
        confirmLabel: 'Reload',
        cancelLabel: 'Later',
      }).then((confirmed) => {
        if (confirmed) void updateSW(true);
      });
    },
  });
}
