import {useAppSettingsStore} from '../store';
import {useSystemColorScheme} from './useSystemColorScheme';

export type ResolvedTheme = 'light' | 'dark';

/**
 * Resolve the effective rendered theme (009-settings-preferences, Req 1.2/2).
 *
 * Maps the user's `themePreference` plus the OS scheme to a concrete
 * `'light' | 'dark'`:
 *  - `'light'` → light, `'dark'` → dark (fixed; ignores OS changes — Req 2.7)
 *  - `'system'` → the OS scheme from `useSystemColorScheme`, which itself falls
 *    back to light when the OS scheme is undeterminable (Req 2.6).
 *
 * Re-renders when the preference changes, or when the OS scheme changes *and*
 * the preference is `'system'`.
 */
export function useResolvedTheme(): ResolvedTheme {
  const preference = useAppSettingsStore(s => s.themePreference);
  const systemScheme = useSystemColorScheme();
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return systemScheme;
}
