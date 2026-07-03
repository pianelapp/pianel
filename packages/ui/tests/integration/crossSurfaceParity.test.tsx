/**
 * 009-settings-preferences Task 7.1 / 7.2 — cross-surface parity and
 * profile-switch round-trip on the UI side.
 *
 * Requirements 7.1, 7.2, 7.6, 7.8:
 *  - Both preference surfaces read the same store value: changing accidentals
 *    via `usePreferences` is reflected in a freshly opened quick switch and
 *    vice versa (single source of truth).
 *  - A store-driven profile switch (theme + accidentals) updates the resolved
 *    theme and, with the host subscription active, re-syncs the chord service.
 */
import {render, click} from '../utils/render';
import {renderHook, actSync} from '../utils/renderHook';
import {installMatchMedia} from '../utils/matchMedia';
import {initTestStores} from '../utils/stores';
import {useAppSettingsStore} from '../../src/store';
import {resetProfileService} from '../../src/hooks/useProfiles';
import {getChordService} from '@pianel/core/services/ChordService';
import {usePreferences} from '../../src/hooks/usePreferences';
import {useResolvedTheme} from '../../src/hooks/useResolvedTheme';
import {subscribeChordAccidentals} from '../../src/host/chordAccidentalSync';
import {AccidentalQuickSwitch} from '../../src/components/modals/AccidentalQuickSwitch';

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

function buttonByText(container: HTMLElement, text: string) {
  const el = Array.from(container.querySelectorAll('button')).find(b =>
    (b.textContent ?? '').toLowerCase().includes(text),
  );
  if (!el) throw new Error(`No button "${text}"`);
  return el;
}

describe('cross-surface parity', () => {
  it('quick switch reflects an accidental change made through the hook', () => {
    const hook = renderHook(() => usePreferences());
    actSync(() => hook.current.setAccidentals('flats'));

    const {container, unmount} = render(
      <AccidentalQuickSwitch isLightMode open onClose={() => {}} />,
    );
    expect(buttonByText(container, 'flats').getAttribute('aria-pressed')).toBe('true');
    expect(buttonByText(container, 'sharps').getAttribute('aria-pressed')).toBe('false');

    unmount();
    hook.unmount();
  });

  it('hook reflects an accidental change made in the quick switch', () => {
    const hook = renderHook(() => usePreferences());
    const {container, unmount} = render(
      <AccidentalQuickSwitch isLightMode open onClose={() => {}} />,
    );
    click(buttonByText(container, 'flats'));
    expect(hook.current.accidentalPreference).toBe('flats');
    unmount();
    hook.unmount();
  });
});

describe('profile-switch round-trip (resolved theme + chord re-sync)', () => {
  it('a store-driven switch updates resolved theme and re-syncs the chord service', () => {
    const mm = installMatchMedia(false); // OS light
    getChordService().setUseSharps(true);
    const unsub = subscribeChordAccidentals();

    const theme = renderHook(() => useResolvedTheme());
    expect(theme.current).toBe('light'); // system + OS light

    // Simulate loadProfile pushing a new active profile's prefs into the store.
    actSync(() => {
      useAppSettingsStore.getState().setThemePreference('dark');
      useAppSettingsStore.getState().setAccidentalPreference('flats');
    });

    expect(theme.current).toBe('dark');
    expect(getChordService().getUseSharps()).toBe(false);

    theme.unmount();
    unsub();
    mm.restore();
  });
});
