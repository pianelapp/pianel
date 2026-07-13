/**
 * useLongPress recognizer.
 *
 *  - fires the secondary-action callback once after the hold threshold for a
 *    touch pointer that stays within tolerance, reporting the touch coordinates
 *  - never fires for mouse / pen pointers (right-click path stays authoritative)
 *  - cancels on movement beyond tolerance, early lift, a second concurrent
 *    touch, and a cancelled pointer
 *  - on recognition arms a one-shot window capture guard that swallows the next
 *    emulated click and touch contextmenu, then disarms after the grace window
 *  - exposes suppression styles and cleans up all listeners on unmount
 */
import * as React from 'react';
import {renderHook, actSync} from '../utils/renderHook';
import {useLongPress} from '../../src/hooks/useLongPress';

function ptr(overrides: Partial<React.PointerEvent> = {}): React.PointerEvent {
  return {
    pointerType: 'touch',
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    ...overrides,
  } as unknown as React.PointerEvent;
}

function fireWindow(type: 'click' | 'contextmenu'): Event {
  const evt =
    type === 'click'
      ? new MouseEvent('click', {bubbles: true, cancelable: true})
      : new MouseEvent('contextmenu', {bubbles: true, cancelable: true});
  actSync(() => {
    window.dispatchEvent(evt);
  });
  return evt;
}

describe('useLongPress recognition', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fires onLongPress once after the threshold for a touch, with coordinates', () => {
    const onLongPress = jest.fn();
    const hook = renderHook(() => useLongPress({onLongPress}));

    actSync(() => hook.current.onPointerDown(ptr({clientX: 42, clientY: 99})));
    expect(onLongPress).not.toHaveBeenCalled();

    actSync(() => jest.advanceTimersByTime(500));
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledWith({x: 42, y: 99});

    // Well past the threshold it must not fire again.
    actSync(() => jest.advanceTimersByTime(1000));
    expect(onLongPress).toHaveBeenCalledTimes(1);

    hook.unmount();
  });

  it('does not fire for a mouse pointer', () => {
    const onLongPress = jest.fn();
    const hook = renderHook(() => useLongPress({onLongPress}));

    actSync(() => hook.current.onPointerDown(ptr({pointerType: 'mouse'})));
    actSync(() => jest.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('does not fire for a pen pointer', () => {
    const onLongPress = jest.fn();
    const hook = renderHook(() => useLongPress({onLongPress}));

    actSync(() => hook.current.onPointerDown(ptr({pointerType: 'pen'})));
    actSync(() => jest.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('cancels when the touch moves beyond tolerance', () => {
    const onLongPress = jest.fn();
    const hook = renderHook(() => useLongPress({onLongPress}));

    actSync(() => hook.current.onPointerDown(ptr({clientX: 0, clientY: 0})));
    actSync(() => hook.current.onPointerMove(ptr({clientX: 40, clientY: 0})));
    actSync(() => jest.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('still fires when movement stays within tolerance', () => {
    const onLongPress = jest.fn();
    const hook = renderHook(() => useLongPress({onLongPress}));

    actSync(() => hook.current.onPointerDown(ptr({clientX: 0, clientY: 0})));
    actSync(() => hook.current.onPointerMove(ptr({clientX: 4, clientY: 3})));
    actSync(() => jest.advanceTimersByTime(500));
    expect(onLongPress).toHaveBeenCalledTimes(1);

    hook.unmount();
  });

  it('cancels on an early lift before the threshold', () => {
    const onLongPress = jest.fn();
    const hook = renderHook(() => useLongPress({onLongPress}));

    actSync(() => hook.current.onPointerDown(ptr()));
    actSync(() => jest.advanceTimersByTime(100));
    actSync(() => hook.current.onPointerUp(ptr()));
    actSync(() => jest.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('cancels on a second concurrent touch', () => {
    const onLongPress = jest.fn();
    const hook = renderHook(() => useLongPress({onLongPress}));

    actSync(() => hook.current.onPointerDown(ptr({pointerId: 1})));
    actSync(() => hook.current.onPointerDown(ptr({pointerId: 2})));
    actSync(() => jest.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('cancels on pointercancel', () => {
    const onLongPress = jest.fn();
    const hook = renderHook(() => useLongPress({onLongPress}));

    actSync(() => hook.current.onPointerDown(ptr()));
    actSync(() => hook.current.onPointerCancel(ptr()));
    actSync(() => jest.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('does nothing when disabled', () => {
    const onLongPress = jest.fn();
    const hook = renderHook(() =>
      useLongPress({onLongPress, enabled: false}),
    );

    actSync(() => hook.current.onPointerDown(ptr()));
    actSync(() => jest.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('honors a custom threshold', () => {
    const onLongPress = jest.fn();
    const hook = renderHook(() =>
      useLongPress({onLongPress, threshold: 400}),
    );

    actSync(() => hook.current.onPointerDown(ptr()));
    actSync(() => jest.advanceTimersByTime(399));
    expect(onLongPress).not.toHaveBeenCalled();
    actSync(() => jest.advanceTimersByTime(1));
    expect(onLongPress).toHaveBeenCalledTimes(1);

    hook.unmount();
  });
});

describe('useLongPress native-side-effect suppression', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function recognize(onLongPress = jest.fn()) {
    const hook = renderHook(() => useLongPress({onLongPress}));
    actSync(() => hook.current.onPointerDown(ptr()));
    actSync(() => jest.advanceTimersByTime(500));
    return hook;
  }

  it('exposes suppression styles', () => {
    const hook = renderHook(() => useLongPress({onLongPress: jest.fn()}));
    expect(hook.current.style).toMatchObject({
      WebkitTouchCallout: 'none',
      userSelect: 'none',
      touchAction: 'manipulation',
    });
    hook.unmount();
  });

  it('swallows the next click after recognition', () => {
    const hook = recognize();
    const evt = fireWindow('click');
    expect(evt.defaultPrevented).toBe(true);
    hook.unmount();
  });

  it('swallows the next touch contextmenu after recognition', () => {
    const hook = recognize();
    const evt = fireWindow('contextmenu');
    expect(evt.defaultPrevented).toBe(true);
    hook.unmount();
  });

  it('only swallows one click (one-shot)', () => {
    const hook = recognize();
    expect(fireWindow('click').defaultPrevented).toBe(true);
    expect(fireWindow('click').defaultPrevented).toBe(false);
    hook.unmount();
  });

  it('disarms after the grace timeout', () => {
    const hook = recognize();
    actSync(() => jest.advanceTimersByTime(1000));
    expect(fireWindow('click').defaultPrevented).toBe(false);
    hook.unmount();
  });

  it('does not suppress when no long-press was recognized', () => {
    const hook = renderHook(() => useLongPress({onLongPress: jest.fn()}));
    actSync(() => hook.current.onPointerDown(ptr()));
    actSync(() => hook.current.onPointerUp(ptr()));
    actSync(() => jest.advanceTimersByTime(1000));
    expect(fireWindow('click').defaultPrevented).toBe(false);
    hook.unmount();
  });

  it('removes the window guard on unmount', () => {
    const hook = recognize();
    hook.unmount();
    expect(fireWindow('click').defaultPrevented).toBe(false);
  });
});
