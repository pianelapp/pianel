import * as React from 'react';
import {act, useState} from 'react';
import {render} from '../../utils/render';
import {Fader, type FaderProps} from '../../../src/components/controls/Fader';

type HarnessProps = Partial<Omit<FaderProps, 'value' | 'onValueChange'>> & {
  initial: number;
  onChange?: jest.Mock;
};

function Harness({initial, onChange, ...rest}: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <Fader
      label="Test Volume"
      isLightMode
      {...rest}
      value={value}
      onValueChange={v => {
        onChange?.(v);
        setValue(v);
      }}
    />
  );
}

function slider(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="range"]') as HTMLInputElement;
}

function key(el: Element, k: string, init: KeyboardEventInit = {}): void {
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true, ...init}),
    );
  });
}

function wheel(el: Element, deltaY: number): WheelEvent {
  const event = new WheelEvent('wheel', {deltaY, bubbles: true, cancelable: true});
  act(() => {
    el.dispatchEvent(event);
  });
  return event;
}

describe('Fader', () => {
  it('exposes a vertical slider with its name, range and value', () => {
    const {container, unmount} = render(<Harness initial={40} />);
    const input = slider(container);
    expect(input).not.toBeNull();
    expect(input.getAttribute('aria-label')).toBe('Test Volume');
    expect(input.getAttribute('aria-orientation')).toBe('vertical');
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
    expect(input.step).toBe('1');
    expect(input.value).toBe('40');
    unmount();
  });

  it('announces the plain position when no formatter is supplied', () => {
    const {container, unmount} = render(<Harness initial={40} />);
    const text = slider(container).getAttribute('aria-valuetext');
    expect(text === null || text === '40').toBe(true);
    unmount();
  });

  it('announces formatted value text only when a formatter is supplied', () => {
    const {container, unmount} = render(
      <Harness initial={40} formatValueText={v => `${v} units`} />,
    );
    expect(slider(container).getAttribute('aria-valuetext')).toBe('40 units');
    unmount();
  });

  it('links the description to the slider', () => {
    const {container, unmount} = render(
      <Harness initial={40} describedById="desc-id" />,
    );
    expect(slider(container).getAttribute('aria-describedby')).toBe('desc-id');
    unmount();
  });

  it('steps by one with the arrow keys', () => {
    const onChange = jest.fn();
    const {container, unmount} = render(
      <Harness initial={40} onChange={onChange} />,
    );
    key(slider(container), 'ArrowUp');
    expect(onChange).toHaveBeenLastCalledWith(41);
    key(slider(container), 'ArrowRight');
    expect(onChange).toHaveBeenLastCalledWith(42);
    key(slider(container), 'ArrowDown');
    expect(onChange).toHaveBeenLastCalledWith(41);
    key(slider(container), 'ArrowLeft');
    expect(onChange).toHaveBeenLastCalledWith(40);
    expect(slider(container).value).toBe('40');
    unmount();
  });

  it('steps by ten with Page Up and Page Down', () => {
    const onChange = jest.fn();
    const {container, unmount} = render(
      <Harness initial={40} onChange={onChange} />,
    );
    key(slider(container), 'PageUp');
    expect(onChange).toHaveBeenLastCalledWith(50);
    key(slider(container), 'PageDown');
    key(slider(container), 'PageDown');
    expect(onChange).toHaveBeenLastCalledWith(30);
    unmount();
  });

  it('jumps to the ends with Home and End', () => {
    const onChange = jest.fn();
    const {container, unmount} = render(
      <Harness initial={40} onChange={onChange} />,
    );
    key(slider(container), 'End');
    expect(onChange).toHaveBeenLastCalledWith(100);
    key(slider(container), 'Home');
    expect(onChange).toHaveBeenLastCalledWith(0);
    unmount();
  });

  it('cancels the reset gestures', () => {
    const onChange = jest.fn();
    const {container, unmount} = render(
      <Harness initial={40} onChange={onChange} />,
    );
    key(slider(container), 'Delete');
    key(slider(container), 'Backspace');
    const control = container.querySelector('[data-slot="fader-track"]')!
      .parentElement as HTMLElement;
    act(() => {
      control.dispatchEvent(
        new MouseEvent('dblclick', {bubbles: true, cancelable: true}),
      );
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(slider(container).value).toBe('40');
    unmount();
  });

  it('moves one step per wheel event, upward is louder, and keeps the page from scrolling', () => {
    const onChange = jest.fn();
    const {container, unmount} = render(
      <Harness initial={40} onChange={onChange} />,
    );
    const up = wheel(slider(container), -120);
    expect(up.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(41);
    const down = wheel(slider(container), 120);
    expect(down.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(40);
    expect(onChange).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('never leaves the range and skips unchanged values', () => {
    const onChange = jest.fn();
    const {container, unmount} = render(
      <Harness initial={100} onChange={onChange} />,
    );
    key(slider(container), 'ArrowUp');
    key(slider(container), 'PageUp');
    key(slider(container), 'End');
    const event = wheel(slider(container), -120);
    expect(event.defaultPrevented).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    key(slider(container), 'Home');
    key(slider(container), 'ArrowDown');
    key(slider(container), 'PageDown');
    wheel(slider(container), 120);
    expect(onChange.mock.calls).toEqual([[0]]);
    unmount();
  });

  it('rounds and clamps every emitted value', () => {
    const onChange = jest.fn();
    const {container, unmount} = render(
      <Fader
        label="Test Volume"
        isLightMode
        value={50}
        onValueChange={onChange}
      />,
    );
    const input = slider(container);
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!;
      setter.call(input, '72.6');
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
    });
    for (const [v] of onChange.mock.calls) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    unmount();
  });

  it('blocks input while disabled', () => {
    const onChange = jest.fn();
    const {container, unmount} = render(
      <Harness initial={40} onChange={onChange} disabled />,
    );
    const input = slider(container);
    expect(input.disabled).toBe(true);
    key(input, 'ArrowUp');
    key(input, 'End');
    const event = wheel(input, -120);
    expect(event.defaultPrevented).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    const root = container.firstElementChild as HTMLElement;
    expect(root.hasAttribute('data-disabled')).toBe(true);
    unmount();
  });

  it('shows a visible focus ring on keyboard focus', () => {
    const {container, unmount} = render(<Harness initial={40} />);
    const thumb = container.querySelector(
      '[data-slot="fader-thumb"]',
    ) as HTMLElement;
    expect(thumb.className).toMatch(/has-focus-visible:ring-\d/);
    expect(thumb.className).toContain('has-focus-visible:ring-ring');
    unmount();
  });

  it('draws three grip lines on the thumb and no built-in value readout', () => {
    const {container, unmount} = render(<Harness initial={40} />);
    expect(
      container.querySelectorAll('[data-slot="fader-thumb-inner"] > div'),
    ).toHaveLength(3);
    expect(container.querySelector('[data-slot="fader-value"]')).toBeNull();
    unmount();
  });

  it('renders decorative marks, labelled only where a label is given', () => {
    const {container, unmount} = render(
      <Harness
        initial={40}
        marks={[{value: 0, label: '0'}, 25, 50, 75, {value: 100, label: '100'}]}
      />,
    );
    const scale = container.querySelector(
      '[data-slot="fader-scale"]',
    ) as HTMLElement;
    expect(scale.getAttribute('aria-hidden')).toBe('true');
    expect(scale.children).toHaveLength(5);
    expect(scale.textContent).toBe('0100');
    unmount();
  });

  it('scopes the theme on its root and applies the height', () => {
    const light = render(<Harness initial={40} height="8rem" />);
    const lightRoot = light.container.firstElementChild as HTMLElement;
    expect(lightRoot.classList.contains('pianel-fader')).toBe(true);
    expect(lightRoot.classList.contains('dark')).toBe(false);
    expect(lightRoot.style.getPropertyValue('--fader-min-height')).toBe('8rem');
    light.unmount();

    const dark = render(<Harness initial={40} isLightMode={false} />);
    const darkRoot = dark.container.firstElementChild as HTMLElement;
    expect(darkRoot.classList.contains('pianel-fader')).toBe(true);
    expect(darkRoot.classList.contains('dark')).toBe(true);
    expect(darkRoot.style.getPropertyValue('--fader-min-height')).toBe('10rem');
    dark.unmount();
  });
});
