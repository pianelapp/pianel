/**
 * useDismissable — close an overlay on an outside `pointerdown` (touch + mouse +
 * pen) or on Escape.
 *
 * Using `pointerdown` (rather than `mousedown`) lets a touch tap-outside dismiss
 * the overlay too. Pointer-downs inside the referenced element are ignored so
 * in-menu item activation is unaffected, and all listeners are removed on unmount.
 */
import { useEffect } from 'react';
import type React from 'react';

export function useDismissable(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    const onPointerDown = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [ref, onClose]);
}
