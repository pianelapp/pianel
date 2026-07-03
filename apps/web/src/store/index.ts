/**
 * Web store wiring.
 *
 * The five domain stores now live in the shared `@pianel/ui` registry. This
 * module only constructs the web IndexedDB-backed `StateStorage` adapter and
 * re-exports the shared store hooks/types/constants so web host code can keep
 * importing them from a single local path. The host injects `webStorage` into
 * the shared registry via `initStores(...)` in `main.tsx` before render.
 */
export * from '@pianel/ui/store';

import { createIndexedDbStorage } from './indexedDbStorage';
import { showAlert } from '@pianel/ui/components/modals/AlertModal';

/**
 * Single web storage instance shared by all five domain stores. A write
 * failure (quota exceeded / storage blocked) is surfaced non-fatally via the
 * shared alert UI; in-memory UI state stays usable.
 */
export const webStorage = createIndexedDbStorage({
  onWriteError: (key, error) => {
    const detail = error instanceof Error ? error.message : String(error);
    showAlert({
      variant: 'warning',
      title: 'Could not save changes',
      message:
        `Your browser blocked saving "${key}" (${detail}). ` +
        'Your current session still works, but changes may not persist. ' +
        'Free up storage or allow site data, then try again.',
    });
  },
});
