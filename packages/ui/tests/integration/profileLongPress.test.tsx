/**
 * Profile row long-press.
 *
 *  - a long-press opens the profile actions menu at the touch point with the
 *    full action set
 *  - an outside tap closes it; the primary load does not fire (emulated click
 *    suppressed)
 *  - selecting Delete runs the existing confirm flow
 */
import * as React from 'react';
import {act} from 'react';
import {render} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {resetProfileService} from '../../src/hooks/useProfiles';
import {
  useProfilesStore,
  DEFAULT_PERFORMANCE_SNAPSHOT,
  type Profile,
} from '../../src/store';
import {ProfilesScreen} from '../../src/screens/profiles/ProfilesScreen';
import {AlertModal} from '../../src/components/modals/AlertModal';

beforeAll(() => {
  initTestStores();
});

const PROFILE: Profile = {
  id: 'p1',
  name: 'My Profile',
  schemaVersion: 1,
  theme: 'system',
  accidentals: 'sharps',
  favorites: [],
  presets: [],
  defaultState: DEFAULT_PERFORMANCE_SNAPSHOT,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

beforeEach(() => {
  resetProfileService();
  act(() => {
    useProfilesStore.setState({profiles: [PROFILE], activeProfileId: ''});
  });
});

function ui() {
  return (
    <>
      <ProfilesScreen isLightMode />
      <AlertModal isLightMode />
    </>
  );
}

function profileRow(container: HTMLElement) {
  const btn = Array.from(container.querySelectorAll('button')).find(b =>
    (b.textContent ?? '').includes('My Profile'),
  );
  if (!btn) throw new Error('profile row not found');
  return btn as HTMLButtonElement;
}

function menu() {
  return document.querySelector('[role="menu"]');
}

function menuItems() {
  const m = menu();
  if (!m) throw new Error('menu not open');
  return Array.from(m.querySelectorAll('[role="menuitem"]')).map(
    b => (b.textContent ?? '').trim(),
  );
}

function menuItem(label: string) {
  const m = menu();
  if (!m) throw new Error('menu not open');
  const btn = Array.from(m.querySelectorAll('[role="menuitem"]')).find(
    b => (b.textContent ?? '').trim().includes(label),
  );
  if (!btn) throw new Error(`menu item "${label}" not found`);
  return btn as HTMLButtonElement;
}

function touchPointerDown(el: Element, x = 40, y = 50) {
  const e = new MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(e, 'pointerType', {value: 'touch'});
  Object.defineProperty(e, 'pointerId', {value: 1});
  act(() => {
    el.dispatchEvent(e);
  });
}

async function longPress(el: Element, x = 40, y = 50) {
  touchPointerDown(el, x, y);
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
}

describe('profile row long-press', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('opens the actions menu at the touch point with the full action set', async () => {
    const {container, unmount} = render(ui());
    expect(menu()).toBeNull();

    await longPress(profileRow(container), 120, 140);

    expect(menu()).not.toBeNull();
    expect(menuItems()).toEqual([
      'Set as Default',
      'Update',
      'Rename',
      'Export',
      'Delete',
    ]);
    const el = menu() as HTMLElement;
    expect(el.style.top).toBe('140px');
    expect(el.style.left).toBe('120px');
    unmount();
  });

  it('closes on an outside tap', async () => {
    const {container, unmount} = render(ui());
    await longPress(profileRow(container));
    expect(menu()).not.toBeNull();

    act(() => {
      document.body.dispatchEvent(
        new MouseEvent('pointerdown', {bubbles: true}),
      );
    });
    expect(menu()).toBeNull();
    unmount();
  });

  it('suppresses the emulated primary click (no profile load) after a long-press', async () => {
    const {container, unmount} = render(ui());
    const row = profileRow(container);
    await longPress(row);

    const click = new MouseEvent('click', {bubbles: true, cancelable: true});
    act(() => {
      row.dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    unmount();
  });

  it('runs the existing Delete confirm flow from a long-press menu', async () => {
    const {container, unmount} = render(ui());
    await longPress(profileRow(container));

    await act(async () => {
      jest.advanceTimersByTime(1000); // disarm suppression guard
    });
    await act(async () => {
      menuItem('Delete').dispatchEvent(
        new MouseEvent('click', {bubbles: true, cancelable: true}),
      );
    });

    const d = document.querySelector('[role="alertdialog"]');
    expect(d).not.toBeNull();
    expect(d?.textContent).toContain('Delete profile?');
    unmount();
  });
});
