import {useEffect, useState} from 'react';

export type ColorScheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Read and subscribe to the OS color scheme (009-settings-preferences, Req 2).
 *
 * Specializes the existing `useMediaQuery` `matchMedia` pattern for
 * `(prefers-color-scheme: dark)`:
 *  - returns `'dark'` when the OS reports dark, `'light'` otherwise (Req 2.1/2.2)
 *  - updates live on the OS `change` event without an app restart (Req 2.3)
 *  - returns `'light'` (undeterminable fallback) when `window`/`matchMedia` is
 *    unavailable or throws; never throws (Req 2.6).
 */
export function useSystemColorScheme(): ColorScheme {
  const read = (): ColorScheme => {
    try {
      if (typeof window === 'undefined' || !window.matchMedia) return 'light';
      return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  };

  const [scheme, setScheme] = useState<ColorScheme>(read);

  useEffect(() => {
    let mql: MediaQueryList;
    try {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      mql = window.matchMedia(DARK_QUERY);
    } catch {
      return;
    }
    const handler = (e: MediaQueryListEvent) =>
      setScheme(e.matches ? 'dark' : 'light');
    setScheme(mql.matches ? 'dark' : 'light');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return scheme;
}
