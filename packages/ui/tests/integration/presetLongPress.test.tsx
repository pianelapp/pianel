/**
 * Preset tile long-press.
 *
 *  - a long-press on a filled tile opens the actions menu at the touch point
 *  - a long-press on an empty tile does nothing (parity with ignored empty
 *    right-click); the primary apply does not fire
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
  type Preset,
  type Profile,
} from '../../src/store';
import {PresetsScreen} from '../../src/screens/presets/PresetsScreen';
import {AlertModal} from '../../src/components/modals/AlertModal';

beforeAll(() => {
  initTestStores();
});

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
  name: 'Profile',
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
  });
});

function ui() {
  return (
    <>
      <PresetsScreen isLightMode />
      <AlertModal isLightMode />
    </>
  );
}

function filledTile(container: HTMLElement) {
  const btn = container.querySelector(
    'button[aria-label="Apply preset \\"Grand Piano\\""]',
  );
  if (!btn) throw new Error('filled tile not found');
  return btn as HTMLButtonElement;
}

function emptyTile(container: HTMLElement) {
  const btn = container.querySelector('button[aria-label="Empty preset 2"]');
  if (!btn) throw new Error('empty tile not found');
  return btn as HTMLButtonElement;
}

function menu() {
  return document.querySelector('[role="menu"]');
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

describe('preset tile long-press', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('opens the actions menu at the touch point for a filled tile', async () => {
    const {container, unmount} = render(ui());
    expect(menu()).toBeNull();

    await longPress(filledTile(container), 90, 110);

    expect(menu()).not.toBeNull();
    const items = Array.from(
      menu()!.querySelectorAll('[role="menuitem"]'),
    ).map(b => (b.textContent ?? '').trim());
    expect(items).toEqual(['Update', 'Rename', 'Delete']);
    const el = menu() as HTMLElement;
    expect(el.style.top).toBe('110px');
    expect(el.style.left).toBe('90px');
    unmount();
  });

  it('does nothing on an empty tile long-press', async () => {
    const {container, unmount} = render(ui());
    await longPress(emptyTile(container));
    expect(menu()).toBeNull();
    // No naming dialog opened either (primary apply/save not triggered).
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    unmount();
  });

  it('suppresses the emulated primary apply after a long-press', async () => {
    const {container, unmount} = render(ui());
    const tile = filledTile(container);
    await longPress(tile);

    const click = new MouseEvent('click', {bubbles: true, cancelable: true});
    act(() => {
      tile.dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    unmount();
  });

  it('runs the existing Delete confirm flow from a long-press menu', async () => {
    const {container, unmount} = render(ui());
    await longPress(filledTile(container));

    await act(async () => {
      jest.advanceTimersByTime(1000); // disarm suppression guard
    });
    const deleteItem = Array.from(
      menu()!.querySelectorAll('[role="menuitem"]'),
    ).find(b => (b.textContent ?? '').trim() === 'Delete')!;
    await act(async () => {
      deleteItem.dispatchEvent(
        new MouseEvent('click', {bubbles: true, cancelable: true}),
      );
    });

    const d = document.querySelector('[role="alertdialog"]');
    expect(d).not.toBeNull();
    expect(d?.textContent).toContain('Delete preset?');
    unmount();
  });
});
