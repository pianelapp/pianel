/**
 * Host-level glue that keeps the live chord display's sharp/flat spelling in
 * agreement with the restored / current `accidentalPreference`
 * (009-settings-preferences, Req 6.4 / 7.1 / 7.3).
 *
 * Shared by both web-tech hosts (`apps/desktop`, `apps/web`) so the wiring is
 * symmetric. The host calls `syncChordAccidentalsFromStore()` once after
 * bootstrap resolves (boot restore) and registers `subscribeChordAccidentals()`
 * exactly once at module scope so any subsequent store-driven accidental change
 * — including a profile switch via `loadProfile` from the Profiles screen —
 * re-syncs the chord service. Registering at module scope (not in a React
 * effect) avoids StrictMode double-registration.
 *
 * This is a read-only store → ChordService sync: it never writes back to the
 * profile, so it cannot create the boot feedback churn a store→profile mirror
 * would.
 */
import {useAppSettingsStore} from '../store';
import {getChordService} from '@pianel/core/services/ChordService';
import type {AccidentalPreference} from '../store';

function applyAccidentals(pref: AccidentalPreference): void {
  getChordService().setUseSharps(pref === 'sharps');
}

/** Read the current accidental preference from the store and apply it. */
export function syncChordAccidentalsFromStore(): void {
  applyAccidentals(useAppSettingsStore.getState().accidentalPreference);
}

/**
 * Subscribe the chord service to store accidental-preference changes. The base
 * zustand `subscribe` fires on every store change, so we compare the field and
 * only re-sync when it actually changed. Returns an unsubscribe function.
 */
export function subscribeChordAccidentals(): () => void {
  let last = useAppSettingsStore.getState().accidentalPreference;
  return useAppSettingsStore.subscribe(state => {
    if (state.accidentalPreference !== last) {
      last = state.accidentalPreference;
      applyAccidentals(last);
    }
  });
}
