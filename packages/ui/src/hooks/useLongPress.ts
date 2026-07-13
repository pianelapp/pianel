/**
 * useLongPress — a reusable recognizer for a touch-only press-and-hold gesture
 * that routes to the same secondary action a desktop right-click triggers, plus
 * suppression of the browser's native long-press side effects.
 *
 *  - Recognition runs only for `pointerType === 'touch'`; mouse and pen fall
 *    through to the existing `onContextMenu` path.
 *  - A timer starts on touch press-down and fires `onLongPress` once when the
 *    threshold elapses with the touch still within `moveTolerance`.
 *  - The pending press is cancelled (fail-safe, no action) on movement beyond
 *    tolerance, an early lift, a second concurrent touch, or pointercancel.
 *  - On recognition a one-shot window-level capture guard swallows the next
 *    emulated `click` and touch `contextmenu` so neither the primary tap nor a
 *    duplicate secondary action fires.
 *  - Recognition uses refs/timers only (never React state) so idle cost is zero;
 *    all timers and listeners are cleared on gesture end and on unmount.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type React from 'react';

/** Viewport coordinates of the recognized touch, for anchoring overlays. */
export interface LongPressPoint {
  /** clientX of the touch. */
  x: number;
  /** clientY of the touch. */
  y: number;
}

export interface UseLongPressOptions {
  /** Invoked exactly once per recognized touch press-and-hold. */
  onLongPress: (point: LongPressPoint) => void;
  /** Hold duration in ms before recognition. Default 500. */
  threshold?: number;
  /** Max movement in px tolerated before the pending press is cancelled. Default 10. */
  moveTolerance?: number;
  /**
   * When false, all touch handling is inert and the primary tap is unaffected
   * (e.g. empty preset tiles / empty quick-assign slots). Default true.
   */
  enabled?: boolean;
}

/** Props spread onto the target element (a <button>). */
export interface LongPressBindings {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  /** touch-callout / user-select / touch-action suppression styles. */
  style: React.CSSProperties;
}

const DEFAULT_THRESHOLD_MS = 500;
const DEFAULT_MOVE_TOLERANCE_PX = 10;
/**
 * How long the post-recognition capture guard stays armed. Must comfortably
 * outlast iOS Safari's delayed synthetic click after a long-press.
 */
const SUPPRESSION_GRACE_MS = 700;

/** Suppress the iOS callout, selection, and double-tap zoom while keeping scroll. */
const SUPPRESSION_STYLE: React.CSSProperties = {
  WebkitTouchCallout: 'none',
  WebkitUserSelect: 'none',
  userSelect: 'none',
  touchAction: 'manipulation',
};

export function useLongPress(options: UseLongPressOptions): LongPressBindings {
  const {
    onLongPress,
    threshold = DEFAULT_THRESHOLD_MS,
    moveTolerance = DEFAULT_MOVE_TOLERANCE_PX,
    enabled = true,
  } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<LongPressPoint | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  // Cleanup for the currently-armed suppression guard, if any.
  const guardCleanupRef = useRef<(() => void) | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
    activePointerIdRef.current = null;
  }, []);

  const armSuppressionGuard = useCallback(() => {
    // Disarm any previous guard first (defensive; recognition is single-shot).
    guardCleanupRef.current?.();

    let disposed = false;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;

    const swallow = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    const onClick = (ev: Event) => {
      swallow(ev);
      window.removeEventListener('click', onClick, true);
    };
    const onContextMenu = (ev: Event) => {
      swallow(ev);
      window.removeEventListener('contextmenu', onContextMenu, true);
    };

    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('contextmenu', onContextMenu, true);
      if (graceTimer !== null) clearTimeout(graceTimer);
      guardCleanupRef.current = null;
    };

    // Capture phase so the guard neutralizes the emulated click / contextmenu
    // regardless of which element (the control or a freshly-opened menu under
    // the finger) receives it.
    window.addEventListener('click', onClick, true);
    window.addEventListener('contextmenu', onContextMenu, true);
    graceTimer = setTimeout(cleanup, SUPPRESSION_GRACE_MS);
    guardCleanupRef.current = cleanup;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      if (e.pointerType !== 'touch') return;
      // A second concurrent touch while a press is pending cancels it.
      if (timerRef.current !== null || activePointerIdRef.current !== null) {
        cancel();
        return;
      }
      const point: LongPressPoint = { x: e.clientX, y: e.clientY };
      startRef.current = point;
      activePointerIdRef.current = e.pointerId;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        startRef.current = null;
        activePointerIdRef.current = null;
        armSuppressionGuard();
        onLongPress(point);
      }, threshold);
    },
    [enabled, threshold, cancel, armSuppressionGuard, onLongPress],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (timerRef.current === null || startRef.current === null) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (Math.hypot(dx, dy) > moveTolerance) cancel();
    },
    [moveTolerance, cancel],
  );

  const onPointerUp = useCallback(() => {
    // A lift while the timer is still pending is a primary tap, not a
    // long-press. If the timer already fired, this is a no-op.
    cancel();
  }, [cancel]);

  const onPointerCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  // Clear any pending timer and disarm the guard on unmount (no leaks).
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      guardCleanupRef.current?.();
    },
    [],
  );

  return useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      style: SUPPRESSION_STYLE,
    }),
    [onPointerDown, onPointerMove, onPointerUp, onPointerCancel],
  );
}
