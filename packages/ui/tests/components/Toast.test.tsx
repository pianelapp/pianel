import { act } from 'react';
import { render } from '../utils/render';
import { Toast, showToast, TOAST_DURATION_MS } from '../../src/components/Toast';

function region(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[role="status"]');
  if (!el) throw new Error('live region not found');
  return el as HTMLElement;
}

function matchMediaFor(matching: string): void {
  (window as unknown as {matchMedia: unknown}).matchMedia = (query: string) => ({
    matches: query === matching,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  matchMediaFor('none');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Toast', () => {
  it('mounts the live region before any message is shown', () => {
    const { container, unmount } = render(<Toast isLightMode={false} />);
    const el = region(container);
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-atomic')).toBe('true');
    expect(el.textContent).toBe('');
    unmount();
  });

  it('never intercepts pointer events', () => {
    const { container, unmount } = render(<Toast isLightMode={false} />);
    expect(region(container).className).toContain('pointer-events-none');
    unmount();
  });

  it('updates the existing region rather than remounting it', () => {
    const { container, unmount } = render(<Toast isLightMode={false} />);
    const before = region(container);

    act(() => showToast('Concert Piano sent to channel 5'));

    const after = region(container);
    expect(after).toBe(before);
    expect(after.textContent).toBe('Concert Piano sent to channel 5');
    unmount();
  });

  it('clears the text after the configured duration with no dismissal', () => {
    const { container, unmount } = render(<Toast isLightMode={false} />);
    act(() => showToast('Concert Piano sent to channel 5'));
    expect(region(container).textContent).not.toBe('');

    act(() => {
      jest.advanceTimersByTime(TOAST_DURATION_MS);
    });

    expect(region(container).textContent).toBe('');
    unmount();
  });

  it('replaces the current message and restarts the timer', () => {
    const { container, unmount } = render(<Toast isLightMode={false} />);
    act(() => showToast('first'));
    act(() => {
      jest.advanceTimersByTime(TOAST_DURATION_MS - 1000);
    });
    act(() => showToast('second'));

    expect(region(container).textContent).toBe('second');

    act(() => {
      jest.advanceTimersByTime(TOAST_DURATION_MS - 1000);
    });
    expect(region(container).textContent).toBe('second');

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(region(container).textContent).toBe('');
    unmount();
  });

  it('styles the message differently in each theme', () => {
    const classNames: string[] = [];
    for (const isLightMode of [true, false]) {
      const { container, unmount } = render(<Toast isLightMode={isLightMode} />);
      act(() => showToast('themed'));
      const message = region(container).firstElementChild as HTMLElement;
      expect(message.textContent).toBe('themed');
      classNames.push(message.className);
      unmount();
    }
    expect(classNames[0]).not.toBe(classNames[1]);
    expect(classNames[0]).toContain('bg-white');
    expect(classNames[1]).toContain('bg-zinc-900');
  });

  it('animates the entrance only when motion is not reduced', () => {
    const shown = render(<Toast isLightMode={false} />);
    act(() => showToast('moving'));
    expect(
      (region(shown.container).firstElementChild as HTMLElement).className,
    ).toContain('animate-toast-in');
    shown.unmount();

    matchMediaFor('(prefers-reduced-motion: reduce)');
    const reduced = render(<Toast isLightMode={false} />);
    act(() => showToast('still'));
    expect(
      (region(reduced.container).firstElementChild as HTMLElement).className,
    ).not.toContain('animate-toast-in');
    reduced.unmount();
  });

  it('goes inert after unmount', () => {
    const { unmount } = render(<Toast isLightMode={false} />);
    unmount();
    expect(() => showToast('nobody listening')).not.toThrow();
  });
});
