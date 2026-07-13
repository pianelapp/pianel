/**
 * useDismissable — an open overlay closes on an outside pointer-down
 * (touch / mouse / pen) and on Escape, ignores pointer-downs inside the
 * referenced element, and removes its listeners on unmount.
 */
import * as React from 'react';
import {useRef} from 'react';
import {render, keydown} from '../utils/render';
import {act} from 'react';
import {useDismissable} from '../../src/hooks/useDismissable';

function Harness({onClose}: {onClose: () => void}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismissable(ref, onClose);
  return (
    <div ref={ref} data-testid="menu">
      <button data-testid="inside">item</button>
    </div>
  );
}

function pointerDownOn(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}));
  });
}

describe('useDismissable', () => {
  it('closes on an outside pointer-down', () => {
    const onClose = jest.fn();
    const {unmount} = render(<Harness onClose={onClose} />);
    pointerDownOn(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('ignores a pointer-down inside the referenced element', () => {
    const onClose = jest.fn();
    const {container, unmount} = render(<Harness onClose={onClose} />);
    const inside = container.querySelector('[data-testid="inside"]')!;
    pointerDownOn(inside);
    expect(onClose).not.toHaveBeenCalled();
    unmount();
  });

  it('closes on Escape', () => {
    const onClose = jest.fn();
    const {unmount} = render(<Harness onClose={onClose} />);
    keydown('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('removes listeners on unmount', () => {
    const onClose = jest.fn();
    const {unmount} = render(<Harness onClose={onClose} />);
    unmount();
    pointerDownOn(document.body);
    keydown('Escape');
    expect(onClose).not.toHaveBeenCalled();
  });
});
