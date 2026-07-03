import {useCallback} from 'react';
import {useAppSettingsStore} from '../store';
import {getProfileService} from './useProfiles';
import {getChordService} from '@pianel/core/services/ChordService';
import type {ThemePreference, AccidentalPreference} from '../store';

export interface PreferencesApi {
  themePreference: ThemePreference;
  accidentalPreference: AccidentalPreference;
  /** Set theme: store (live) + narrow profile write-back (durable). */
  setTheme(pref: ThemePreference): void;
  /** Set accidentals: store (live) + write-back (durable) + ChordService sync. */
  setAccidentals(pref: AccidentalPreference): void;
}

/**
 * The single write path for the theme and accidental preferences across every
 * surface (Settings panel + chord-display quick switch) — 009-settings-preferences.
 *
 * Reads the live values straight from `appSettingsStore` (single source of
 * truth — no parallel preference state, Req 7.4) and, on each setter:
 *  1. calls the store setter so the running UI updates immediately;
 *  2. mirrors the change into the active profile via the narrow `ProfileService`
 *     write-back, guarded with `getProfileService()?.` so a boot-race (service
 *     not yet registered) is skipped safely — mirroring `useFavorites`;
 *  3. for accidentals, drives the live chord spelling via
 *     `ChordService.setUseSharps(pref === 'sharps')` (Req 5.1/5.2).
 */
export function usePreferences(): PreferencesApi {
  const themePreference = useAppSettingsStore(s => s.themePreference);
  const accidentalPreference = useAppSettingsStore(s => s.accidentalPreference);
  const setThemePreference = useAppSettingsStore(s => s.setThemePreference);
  const setAccidentalPreference = useAppSettingsStore(
    s => s.setAccidentalPreference,
  );

  const setTheme = useCallback(
    (pref: ThemePreference) => {
      setThemePreference(pref);
      getProfileService()?.syncActiveTheme();
    },
    [setThemePreference],
  );

  const setAccidentals = useCallback(
    (pref: AccidentalPreference) => {
      setAccidentalPreference(pref);
      getProfileService()?.syncActiveAccidentals();
      getChordService().setUseSharps(pref === 'sharps');
    },
    [setAccidentalPreference],
  );

  return {themePreference, accidentalPreference, setTheme, setAccidentals};
}
