/**
 * 009-settings-preferences Task 2.2 — useResolvedTheme.
 *
 * Requirements 1.2, 2.1-2.7: mapping matrix over preference {system,light,dark}
 * crossed with OS scheme {light, dark, undeterminable}:
 *  - system follows OS
 *  - light/dark ignore subsequent OS changes
 *  - undeterminable system falls back to light
 */
import {renderHook, actSync} from '../utils/renderHook';
import {
  installMatchMedia,
  removeMatchMedia,
} from '../utils/matchMedia';
import {initTestStores} from '../utils/stores';
import {useAppSettingsStore} from '../../src/store';
import {useResolvedTheme} from '../../src/hooks/useResolvedTheme';
import type {ThemePreference} from '../../src/store';

beforeAll(() => {
  initTestStores();
});

function setPreference(pref: ThemePreference) {
  actSync(() => useAppSettingsStore.getState().setThemePreference(pref));
}

describe('useResolvedTheme mapping matrix', () => {
  it("preference 'light' resolves to light regardless of OS", () => {
    const mm = installMatchMedia(true); // OS dark
    setPreference('light');
    const hook = renderHook(() => useResolvedTheme());
    expect(hook.current).toBe('light');
    hook.unmount();
    mm.restore();
  });

  it("preference 'dark' resolves to dark regardless of OS", () => {
    const mm = installMatchMedia(false); // OS light
    setPreference('dark');
    const hook = renderHook(() => useResolvedTheme());
    expect(hook.current).toBe('dark');
    hook.unmount();
    mm.restore();
  });

  it("preference 'system' follows OS dark", () => {
    const mm = installMatchMedia(true);
    setPreference('system');
    const hook = renderHook(() => useResolvedTheme());
    expect(hook.current).toBe('dark');
    hook.unmount();
    mm.restore();
  });

  it("preference 'system' follows OS light", () => {
    const mm = installMatchMedia(false);
    setPreference('system');
    const hook = renderHook(() => useResolvedTheme());
    expect(hook.current).toBe('light');
    hook.unmount();
    mm.restore();
  });

  it("preference 'system' falls back to light when OS undeterminable", () => {
    const restore = removeMatchMedia();
    setPreference('system');
    const hook = renderHook(() => useResolvedTheme());
    expect(hook.current).toBe('light');
    hook.unmount();
    restore();
  });

  it("preference 'system' reacts to a live OS scheme change", () => {
    const mm = installMatchMedia(false);
    setPreference('system');
    const hook = renderHook(() => useResolvedTheme());
    expect(hook.current).toBe('light');
    actSync(() => mm.setDark(true));
    expect(hook.current).toBe('dark');
    hook.unmount();
    mm.restore();
  });

  it("fixed preferences ignore subsequent OS changes", () => {
    const mm = installMatchMedia(false);
    setPreference('light');
    const hook = renderHook(() => useResolvedTheme());
    expect(hook.current).toBe('light');
    actSync(() => mm.setDark(true));
    expect(hook.current).toBe('light');
    hook.unmount();
    mm.restore();
  });
});
