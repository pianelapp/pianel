import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const getMatch = () => {
    try {
      if (typeof window === 'undefined' || !window.matchMedia) return false;
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  };

  const [matches, setMatches] = useState<boolean>(getMatch);

  useEffect(() => {
    let mql: MediaQueryList;
    try {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      mql = window.matchMedia(query);
    } catch {
      return;
    }
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
