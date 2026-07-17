/**
 * Quick-assign clear confirmation.
 *
 *  - a touch long-press and a mouse right-click each open a single error-variant
 *    confirm dialog (Clear / Cancel)
 *  - confirming clears the slot; Cancel leaves it unchanged
 *  - after a long-press the emulated primary click is suppressed
 */
import * as React from 'react';
import {act} from 'react';
import {render} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {useAppSettingsStore} from '../../src/store';
import type {QuickToneSlot} from '@pianel/core/types/quickToneSlot';
import {QuickToneSlots} from '../../src/screens/display/QuickToneSlots';
import {AlertModal} from '../../src/components/modals/AlertModal';

beforeAll(() => {
  initTestStores();
});

const FILLED: QuickToneSlot = {
  voiceMode: 'single',
  rightToneId: 'tone-1',
  leftToneId: null,
  dualTone2Id: null,
};

beforeEach(() => {
  act(() => {
    useAppSettingsStore.getState().setQuickToneSlot(0, FILLED);
    useAppSettingsStore.getState().setQuickToneSlot(1, null);
    useAppSettingsStore.getState().setQuickToneSlot(2, null);
  });
});

function ui() {
  return (
    <>
      <QuickToneSlots isLightMode />
      <AlertModal isLightMode />
    </>
  );
}

function slotButtons(container: HTMLElement) {
  // The three slot buttons are the only buttons before a dialog opens.
  return Array.from(
    container.querySelectorAll('button'),
  ) as HTMLButtonElement[];
}

function dialog() {
  return document.querySelector('[role="alertdialog"]');
}

function dialogButton(label: string) {
  const d = dialog();
  if (!d) throw new Error('no dialog');
  const btn = Array.from(d.querySelectorAll('button')).find(
    b => (b.textContent ?? '').trim() === label,
  );
  if (!btn) throw new Error(`no dialog button "${label}"`);
  return btn as HTMLButtonElement;
}

function touchPointerDown(el: Element) {
  const e = new MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: 40,
    clientY: 50,
  });
  Object.defineProperty(e, 'pointerType', {value: 'touch'});
  Object.defineProperty(e, 'pointerId', {value: 1});
  act(() => {
    el.dispatchEvent(e);
  });
}

/** Fire a recognized long-press and let the confirm dialog open. */
async function longPress(el: Element) {
  touchPointerDown(el);
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
}

function rightClick(el: Element) {
  const e = new MouseEvent('contextmenu', {bubbles: true, cancelable: true});
  act(() => {
    el.dispatchEvent(e);
  });
  return e;
}

async function clickDialog(label: string) {
  // Advance past the suppression grace window so the one-shot click guard is
  // disarmed before the (simulated) confirm tap.
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  await act(async () => {
    dialogButton(label).dispatchEvent(
      new MouseEvent('click', {bubbles: true, cancelable: true}),
    );
  });
}

describe('Quick-assign clear confirmation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('opens an error-variant Clear/Cancel dialog on long-press', async () => {
    const {container, unmount} = render(ui());
    expect(dialog()).toBeNull();

    await longPress(slotButtons(container)[0]);

    expect(dialog()).not.toBeNull();
    const confirm = dialogButton('Clear');
    expect(dialogButton('Cancel')).toBeTruthy();
    expect(confirm.className).toContain('red');
    unmount();
  });

  it('clears the slot when confirmed via long-press', async () => {
    const {container, unmount} = render(ui());
    await longPress(slotButtons(container)[0]);
    await clickDialog('Clear');

    expect(useAppSettingsStore.getState().quickToneSlots[0]).toBeNull();
    unmount();
  });

  it('leaves the slot unchanged when cancelled', async () => {
    const {container, unmount} = render(ui());
    await longPress(slotButtons(container)[0]);
    await clickDialog('Cancel');

    expect(useAppSettingsStore.getState().quickToneSlots[0]).toEqual(FILLED);
    unmount();
  });

  it('opens the same dialog on a mouse right-click and suppresses the native menu', async () => {
    const {container, unmount} = render(ui());
    const evt = rightClick(slotButtons(container)[0]);
    await act(async () => {});

    expect(evt.defaultPrevented).toBe(true);
    expect(dialog()).not.toBeNull();
    await clickDialog('Clear');
    expect(useAppSettingsStore.getState().quickToneSlots[0]).toBeNull();
    unmount();
  });

  it('suppresses the emulated primary click after a long-press', async () => {
    const {container, unmount} = render(ui());
    await longPress(slotButtons(container)[0]);

    const click = new MouseEvent('click', {bubbles: true, cancelable: true});
    act(() => {
      slotButtons(container)[0].dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    unmount();
  });

  it('does not open the dialog on a right-click of an empty slot', async () => {
    const {container, unmount} = render(ui());
    // Slot index 1 is empty (see beforeEach).
    const evt = rightClick(slotButtons(container)[1]);
    await act(async () => {});

    // Native menu is still suppressed, but no destructive prompt appears.
    expect(evt.defaultPrevented).toBe(true);
    expect(dialog()).toBeNull();
    unmount();
  });

  it('does nothing on a long-press of an empty slot and leaves the assign-tap intact', async () => {
    const {container, unmount} = render(ui());
    await longPress(slotButtons(container)[1]);

    // No dialog, and the recognizer never armed the click-suppression guard,
    // so the following (assign) tap is not swallowed.
    expect(dialog()).toBeNull();
    const click = new MouseEvent('click', {bubbles: true, cancelable: true});
    act(() => {
      slotButtons(container)[1].dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(false);
    unmount();
  });
});
