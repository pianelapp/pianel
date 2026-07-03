/**
 * 009-settings-preferences Task 2.1 — useSystemColorScheme.
 *
 * Requirements 2.1, 2.2, 2.3, 2.6:
 *  - returns 'dark' when the OS media query matches
 *  - returns 'light' when it does not
 *  - updates on a live OS scheme change without restart
 *  - returns 'light' (undeterminable fallback) when matchMedia is absent/throws
 */
import {renderHook, actSync} from '../utils/renderHook';
import {
  installMatchMedia,
  removeMatchMedia,
  throwingMatchMedia,
} from '../utils/matchMedia';
import {useSystemColorScheme} from '../../src/hooks/useSystemColorScheme';

describe('useSystemColorScheme', () => {
  it("returns 'dark' when the OS dark media query matches", () => {
    const mm = installMatchMedia(true);
    const hook = renderHook(() => useSystemColorScheme());
    expect(hook.current).toBe('dark');
    hook.unmount();
    mm.restore();
  });

  it("returns 'light' when the OS dark media query does not match", () => {
    const mm = installMatchMedia(false);
    const hook = renderHook(() => useSystemColorScheme());
    expect(hook.current).toBe('light');
    hook.unmount();
    mm.restore();
  });

  it('updates on a live OS scheme change without restart', () => {
    const mm = installMatchMedia(false);
    const hook = renderHook(() => useSystemColorScheme());
    expect(hook.current).toBe('light');
    actSync(() => mm.setDark(true));
    expect(hook.current).toBe('dark');
    actSync(() => mm.setDark(false));
    expect(hook.current).toBe('light');
    hook.unmount();
    mm.restore();
  });

  it("returns 'light' when matchMedia is unavailable", () => {
    const restore = removeMatchMedia();
    const hook = renderHook(() => useSystemColorScheme());
    expect(hook.current).toBe('light');
    hook.unmount();
    restore();
  });

  it("returns 'light' when matchMedia throws", () => {
    const restore = throwingMatchMedia();
    const hook = renderHook(() => useSystemColorScheme());
    expect(hook.current).toBe('light');
    hook.unmount();
    restore();
  });
});
