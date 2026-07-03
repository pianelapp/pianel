/**
 * 009-settings-preferences Task 6.2 — ChordDisplay quick-switch gestures.
 *
 * Requirements 8.1, 8.2, 8.7, 8.8, 8.10:
 *  - desktop right-click suppresses the native menu and opens the quick switch
 *  - touch long-press (pointer-down held past the threshold) opens it
 *  - a quick pointer-up before the threshold does NOT open it
 */
import {render} from '../utils/render';
import {act} from 'react';
import {initTestStores} from '../utils/stores';
import {resetProfileService} from '../../src/hooks/useProfiles';
import {ChordDisplay} from '../../src/screens/display/ChordDisplay';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetProfileService();
});

function dialog(container: HTMLElement) {
  return container.querySelector('[role="dialog"]');
}

function panel(container: HTMLElement) {
  return container.firstElementChild as Element;
}

describe('ChordDisplay quick-switch gestures', () => {
  it('opens the quick switch on right-click and suppresses the native menu', () => {
    const {container, unmount} = render(<ChordDisplay isLightMode />);
    expect(dialog(container)).toBeNull();

    const evt = new MouseEvent('contextmenu', {bubbles: true, cancelable: true});
    act(() => {
      panel(container).dispatchEvent(evt);
    });

    expect(evt.defaultPrevented).toBe(true);
    expect(dialog(container)).not.toBeNull();
    unmount();
  });

  it('opens the quick switch after a long press', () => {
    jest.useFakeTimers();
    const {container, unmount} = render(<ChordDisplay isLightMode />);

    act(() => {
      panel(container).dispatchEvent(
        new PointerEvent('pointerdown', {bubbles: true}),
      );
    });
    expect(dialog(container)).toBeNull();
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(dialog(container)).not.toBeNull();

    unmount();
    jest.useRealTimers();
  });

  it('does not open on a quick tap (pointer-up before threshold)', () => {
    jest.useFakeTimers();
    const {container, unmount} = render(<ChordDisplay isLightMode />);

    act(() => {
      panel(container).dispatchEvent(
        new PointerEvent('pointerdown', {bubbles: true}),
      );
    });
    act(() => {
      jest.advanceTimersByTime(100);
      panel(container).dispatchEvent(
        new PointerEvent('pointerup', {bubbles: true}),
      );
    });
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(dialog(container)).toBeNull();

    unmount();
    jest.useRealTimers();
  });
});
