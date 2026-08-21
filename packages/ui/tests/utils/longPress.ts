import {act} from 'react';

export function menu(): Element | null {
  return document.querySelector('[role="menu"]');
}

export function menuItems(): string[] {
  const m = menu();
  if (!m) throw new Error('menu not open');
  return Array.from(m.querySelectorAll('[role="menuitem"]')).map(b =>
    (b.textContent ?? '').trim(),
  );
}

export function menuItem(label: string): HTMLButtonElement {
  const m = menu();
  if (!m) throw new Error('menu not open');
  const btn = Array.from(m.querySelectorAll('[role="menuitem"]')).find(b =>
    (b.textContent ?? '').trim().includes(label),
  );
  if (!btn) throw new Error(`menu item "${label}" not found`);
  return btn as HTMLButtonElement;
}

export function pointerEvent(type: string, x: number, y: number): MouseEvent {
  const e = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(e, 'pointerType', {value: 'touch'});
  Object.defineProperty(e, 'pointerId', {value: 1});
  return e;
}

export function touchPointerDown(el: Element, x = 40, y = 50): void {
  act(() => {
    el.dispatchEvent(pointerEvent('pointerdown', x, y));
  });
}

export function touchPointerUp(el: Element, x = 40, y = 50): void {
  act(() => {
    el.dispatchEvent(pointerEvent('pointerup', x, y));
  });
}

export async function longPress(el: Element, x = 40, y = 50): Promise<void> {
  touchPointerDown(el, x, y);
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
}
