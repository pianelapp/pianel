/**
 * useClampedMenuPosition — an anchored fixed-position overlay is measured and
 * shifted so it stays fully inside the viewport (minus a small margin); an
 * oversized menu degrades gracefully by pinning to the margin.
 */
import * as React from 'react';
import {useRef} from 'react';
import {render} from '../utils/render';
import {useClampedMenuPosition} from '../../src/hooks/useClampedMenuPosition';

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', {value: w, configurable: true});
  Object.defineProperty(window, 'innerHeight', {value: h, configurable: true});
}

function mockMenuSize(w: number, h: number) {
  return jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({
      width: w,
      height: h,
      top: 0,
      left: 0,
      right: w,
      bottom: h,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
}

function Harness({x, y}: {x: number; y: number}) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useClampedMenuPosition(x, y, ref);
  return (
    <div
      ref={ref}
      data-testid="menu"
      style={{position: 'fixed', top: pos.top, left: pos.left}}
    />
  );
}

function pos(container: HTMLElement) {
  const el = container.querySelector('[data-testid="menu"]') as HTMLElement;
  return {top: parseFloat(el.style.top), left: parseFloat(el.style.left)};
}

describe('useClampedMenuPosition', () => {
  afterEach(() => jest.restoreAllMocks());

  it('leaves an in-bounds anchor unchanged', () => {
    setViewport(400, 400);
    mockMenuSize(50, 50);
    const {container, unmount} = render(<Harness x={10} y={10} />);
    expect(pos(container)).toEqual({top: 10, left: 10});
    unmount();
  });

  it('shifts a near-right/bottom-edge anchor back into view', () => {
    setViewport(400, 400);
    mockMenuSize(100, 100);
    const {container, unmount} = render(<Harness x={380} y={380} />);
    // vw - margin - width = 400 - 8 - 100 = 292
    expect(pos(container)).toEqual({top: 292, left: 292});
    unmount();
  });

  it('pins an oversized menu to the margin', () => {
    setViewport(200, 200);
    mockMenuSize(300, 300);
    const {container, unmount} = render(<Harness x={50} y={50} />);
    expect(pos(container)).toEqual({top: 8, left: 8});
    unmount();
  });
});
