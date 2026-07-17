/**
 * Desktop mouse behavior is preserved.
 *
 *  - mouse right-click on a profile row / preset card opens the existing menu
 *    unchanged; mouse right-click on a Quick-assign button now opens the shared
 *    clear-confirmation dialog (the one intentional change)
 *  - the native context menu stays suppressed on all three controls
 *  - a mouse press-and-hold never triggers the touch long-press path (left-click
 *    primary actions stay unchanged); an empty-tile left-click still opens the
 *    naming dialog
 *
 * The behavior is identical for the Electron desktop app because it relies on
 * the shared @pianel/ui package with no app-specific branching.
 */
import * as React from 'react';
import {act} from 'react';
import {render} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {resetProfileService} from '../../src/hooks/useProfiles';
import {
  useAppSettingsStore,
  useProfilesStore,
  DEFAULT_PERFORMANCE_SNAPSHOT,
  type Preset,
  type Profile,
} from '../../src/store';
import type {QuickToneSlot} from '@pianel/core/types/quickToneSlot';
import {QuickToneSlots} from '../../src/screens/display/QuickToneSlots';
import {ProfilesScreen} from '../../src/screens/profiles/ProfilesScreen';
import {PresetsScreen} from '../../src/screens/presets/PresetsScreen';
import {AlertModal} from '../../src/components/modals/AlertModal';

beforeAll(() => {
  initTestStores();
});

const SLOT: QuickToneSlot = {
  voiceMode: 'single',
  rightToneId: 'tone-1',
  leftToneId: null,
  dualTone2Id: null,
};

const PRESET: Preset = {
  id: 'preset-1',
  label: 'Grand Piano',
  tilePosition: 0,
  snapshot: DEFAULT_PERFORMANCE_SNAPSHOT,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const PROFILE: Profile = {
  id: 'p1',
  name: 'My Profile',
  schemaVersion: 1,
  theme: 'system',
  accidentals: 'sharps',
  favorites: [],
  presets: [PRESET],
  defaultState: DEFAULT_PERFORMANCE_SNAPSHOT,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

beforeEach(() => {
  resetProfileService();
  act(() => {
    useProfilesStore.setState({profiles: [PROFILE], activeProfileId: 'p1'});
    useAppSettingsStore.getState().setQuickToneSlot(0, SLOT);
    useAppSettingsStore.getState().setQuickToneSlot(1, null);
    useAppSettingsStore.getState().setQuickToneSlot(2, null);
  });
});

function rightClick(el: Element) {
  const e = new MouseEvent('contextmenu', {bubbles: true, cancelable: true});
  act(() => {
    el.dispatchEvent(e);
  });
  return e;
}

function mousePointerDown(el: Element) {
  const e = new MouseEvent('pointerdown', {bubbles: true, cancelable: true});
  Object.defineProperty(e, 'pointerType', {value: 'mouse'});
  Object.defineProperty(e, 'pointerId', {value: 1});
  act(() => {
    el.dispatchEvent(e);
  });
}

function byText(container: HTMLElement, text: string) {
  const el = Array.from(container.querySelectorAll('button')).find(b =>
    (b.textContent ?? '').includes(text),
  );
  if (!el) throw new Error(`no button "${text}"`);
  return el as HTMLButtonElement;
}

function menu() {
  return document.querySelector('[role="menu"]');
}

describe('desktop mouse regression', () => {
  it('right-click on a profile row opens the actions menu unchanged', () => {
    const {container, unmount} = render(<ProfilesScreen isLightMode />);
    const evt = rightClick(byText(container, 'My Profile'));
    expect(evt.defaultPrevented).toBe(true);
    expect(menu()).not.toBeNull();
    unmount();
  });

  it('right-click on a filled preset opens the actions menu unchanged', () => {
    const {container, unmount} = render(<PresetsScreen isLightMode />);
    const tile = container.querySelector(
      'button[aria-label="Apply preset \\"Grand Piano\\""]',
    )!;
    const evt = rightClick(tile);
    expect(evt.defaultPrevented).toBe(true);
    expect(menu()).not.toBeNull();
    unmount();
  });

  it('right-click on a Quick-assign button opens the clear-confirmation dialog', async () => {
    const {container, unmount} = render(
      <>
        <QuickToneSlots isLightMode />
        <AlertModal isLightMode />
      </>,
    );
    const slot = container.querySelectorAll('button')[0];
    const evt = rightClick(slot);
    await act(async () => {});
    expect(evt.defaultPrevented).toBe(true);
    const d = document.querySelector('[role="alertdialog"]');
    expect(d).not.toBeNull();
    expect(d?.textContent).toContain('Clear');
    unmount();
  });

  it('a mouse press-and-hold does not open a menu (touch path bypassed)', () => {
    jest.useFakeTimers();
    const {container, unmount} = render(<ProfilesScreen isLightMode />);
    mousePointerDown(byText(container, 'My Profile'));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(menu()).toBeNull();
    unmount();
    jest.useRealTimers();
  });

  it('left-click on an empty preset tile still opens the naming dialog', () => {
    const {container, unmount} = render(<PresetsScreen isLightMode />);
    const empty = container.querySelector('button[aria-label="Empty preset 2"]')!;
    act(() => {
      empty.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    unmount();
  });
});
