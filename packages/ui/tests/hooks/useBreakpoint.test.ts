import { renderHook, actSync } from '../utils/renderHook';
import {
  installViewport,
  removeMatchMedia,
  throwingMatchMedia,
} from '../utils/matchMedia';
import { useBreakpoint } from '../../src/hooks/useBreakpoint';

describe('useBreakpoint', () => {
  // viewport switches at 600 / 1280; sidebar switches at 1000 / 1280.
  it.each([
    [599, 'mobile', 'mobile'],
    [600, 'tablet', 'mobile'],
    [999, 'tablet', 'mobile'],
    [1000, 'tablet', 'tablet'],
    [1279, 'tablet', 'tablet'],
    [1280, 'desktop', 'desktop'],
  ] as const)(
    'at %ipx resolves viewport=%s sidebar=%s',
    (width, viewport, sidebar) => {
      const vp = installViewport(width);
      const hook = renderHook(() => useBreakpoint());
      expect(hook.current).toEqual({ viewport, sidebar });
      hook.unmount();
      vp.restore();
    },
  );

  it('flips both axes live as the viewport crosses boundaries', () => {
    const vp = installViewport(1280);
    const hook = renderHook(() => useBreakpoint());
    expect(hook.current).toEqual({ viewport: 'desktop', sidebar: 'desktop' });

    actSync(() => vp.setWidth(599));
    expect(hook.current).toEqual({ viewport: 'mobile', sidebar: 'mobile' });

    actSync(() => vp.setWidth(800));
    expect(hook.current).toEqual({ viewport: 'tablet', sidebar: 'mobile' });

    actSync(() => vp.setWidth(1100));
    expect(hook.current).toEqual({ viewport: 'tablet', sidebar: 'tablet' });

    actSync(() => vp.setWidth(1440));
    expect(hook.current).toEqual({ viewport: 'desktop', sidebar: 'desktop' });

    hook.unmount();
    vp.restore();
  });

  it("falls back to desktop on both axes when matchMedia is unavailable", () => {
    const restore = removeMatchMedia();
    const hook = renderHook(() => useBreakpoint());
    expect(hook.current).toEqual({ viewport: 'desktop', sidebar: 'desktop' });
    hook.unmount();
    restore();
  });

  it("falls back to desktop on both axes when matchMedia throws", () => {
    const restore = throwingMatchMedia();
    const hook = renderHook(() => useBreakpoint());
    expect(hook.current).toEqual({ viewport: 'desktop', sidebar: 'desktop' });
    hook.unmount();
    restore();
  });
});
