/**
 * useClampedMenuPosition — adjust an anchored, fixed-position overlay so it
 * stays fully within the viewport (minus a small margin).
 *
 * Given the requested anchor `{ x, y }` and a ref to the menu element, the
 * rendered menu is measured and a clamped `{ top, left }` is returned that keeps
 * its bounding box inside `window.innerWidth/innerHeight` minus `margin`. Near
 * the right/bottom edge the menu shifts back into view; an oversized menu
 * degrades gracefully by pinning to the margin. Purely presentational — never
 * alters menu contents or dismissal.
 */
import { useLayoutEffect, useState } from 'react';
import type React from 'react';

export interface ClampedPosition {
  top: number;
  left: number;
}

const DEFAULT_MARGIN = 8;

export function useClampedMenuPosition(
  x: number,
  y: number,
  ref: React.RefObject<HTMLElement | null>,
  margin: number = DEFAULT_MARGIN,
): ClampedPosition {
  const [position, setPosition] = useState<ClampedPosition>({ top: y, left: x });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = x;
    if (left + rect.width > vw - margin) left = vw - margin - rect.width;
    if (left < margin) left = margin;

    let top = y;
    if (top + rect.height > vh - margin) top = vh - margin - rect.height;
    if (top < margin) top = margin;

    setPosition(prev =>
      prev.top === top && prev.left === left ? prev : { top, left },
    );
  }, [x, y, margin, ref]);

  return position;
}
