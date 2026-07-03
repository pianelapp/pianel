/**
 * 009-settings-preferences Task 3 — usePreferences (single write path).
 *
 * Requirements 3.1/3.7, 4.3/4.4, 5.1/5.2, 6.1/6.7, 7.4/7.5/7.6, 8.4-8.6:
 *  - setTheme calls store theme setter (live) then theme write-back (durable)
 *  - setAccidentals calls store accidental setter (live), then accidentals
 *    write-back (durable), then drives ChordService spelling
 *    (sharps → setUseSharps(true), flats → setUseSharps(false))
 *  - setters are idempotent for an unchanged value
 *  - write-back is skipped safely when the profile service is not registered
 *  - the hook exposes current theme/accidental values read live from the store
 */
import {renderHook, actSync} from '../utils/renderHook';
import {initTestStores} from '../utils/stores';
import {useAppSettingsStore} from '../../src/store';
import {
  setProfileService,
  resetProfileService,
} from '../../src/hooks/useProfiles';
import {getChordService} from '@pianel/core/services/ChordService';
import {usePreferences} from '../../src/hooks/usePreferences';
import type {ProfileService} from '@pianel/core/services/profiles/ProfileService';

function fakeProfileService() {
  return {
    syncActiveTheme: jest.fn(),
    syncActiveAccidentals: jest.fn(),
  };
}

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetProfileService();
  actSync(() => {
    useAppSettingsStore.getState().setThemePreference('system');
    useAppSettingsStore.getState().setAccidentalPreference('sharps');
  });
});

describe('usePreferences.setTheme', () => {
  it('sets the store theme (live) then calls the theme write-back (durable)', () => {
    const svc = fakeProfileService();
    setProfileService(svc as unknown as ProfileService);
    const hook = renderHook(() => usePreferences());

    actSync(() => hook.current.setTheme('dark'));

    expect(useAppSettingsStore.getState().themePreference).toBe('dark');
    expect(svc.syncActiveTheme).toHaveBeenCalledTimes(1);
    hook.unmount();
  });

  it('skips write-back safely when no profile service is registered', () => {
    resetProfileService();
    const hook = renderHook(() => usePreferences());
    expect(() => actSync(() => hook.current.setTheme('light'))).not.toThrow();
    expect(useAppSettingsStore.getState().themePreference).toBe('light');
    hook.unmount();
  });
});

describe('usePreferences.setAccidentals', () => {
  it('sets store, calls write-back, and drives ChordService to sharps', () => {
    const svc = fakeProfileService();
    setProfileService(svc as unknown as ProfileService);
    const hook = renderHook(() => usePreferences());

    actSync(() => hook.current.setAccidentals('sharps'));

    expect(useAppSettingsStore.getState().accidentalPreference).toBe('sharps');
    expect(svc.syncActiveAccidentals).toHaveBeenCalledTimes(1);
    expect(getChordService().getUseSharps()).toBe(true);
    hook.unmount();
  });

  it('drives ChordService to flats when flats selected', () => {
    const svc = fakeProfileService();
    setProfileService(svc as unknown as ProfileService);
    const hook = renderHook(() => usePreferences());

    actSync(() => hook.current.setAccidentals('flats'));

    expect(useAppSettingsStore.getState().accidentalPreference).toBe('flats');
    expect(getChordService().getUseSharps()).toBe(false);
    hook.unmount();
  });

  it('skips write-back safely when no profile service is registered', () => {
    resetProfileService();
    const hook = renderHook(() => usePreferences());
    expect(() =>
      actSync(() => hook.current.setAccidentals('flats')),
    ).not.toThrow();
    expect(useAppSettingsStore.getState().accidentalPreference).toBe('flats');
    expect(getChordService().getUseSharps()).toBe(false);
    hook.unmount();
  });
});

describe('usePreferences live values', () => {
  it('exposes current theme and accidental values read live from the store', () => {
    const hook = renderHook(() => usePreferences());
    actSync(() => {
      useAppSettingsStore.getState().setThemePreference('dark');
      useAppSettingsStore.getState().setAccidentalPreference('flats');
    });
    expect(hook.current.themePreference).toBe('dark');
    expect(hook.current.accidentalPreference).toBe('flats');
    hook.unmount();
  });

  it('is idempotent for an unchanged value (write-back still invoked once)', () => {
    const svc = fakeProfileService();
    setProfileService(svc as unknown as ProfileService);
    actSync(() => useAppSettingsStore.getState().setThemePreference('dark'));
    const hook = renderHook(() => usePreferences());

    actSync(() => hook.current.setTheme('dark'));

    expect(useAppSettingsStore.getState().themePreference).toBe('dark');
    expect(svc.syncActiveTheme).toHaveBeenCalledTimes(1);
    hook.unmount();
  });
});
