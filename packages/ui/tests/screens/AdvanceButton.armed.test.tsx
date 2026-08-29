import { render } from '../utils/render';
import { AdvanceButton } from '../../src/screens/perform/AdvanceButton';
import { BASE_SCENE } from '../fixtures/setlists';
import type { NextTarget } from '../../src/hooks/usePerformCursor';

const SCENE_TARGET: NextTarget = { kind: 'scene', scene: BASE_SCENE };
const END_TARGET: NextTarget = { kind: 'end' };

function renderButton(
  over: {
    armedAdvance?: boolean;
    armedPrev?: boolean;
    isLightMode?: boolean;
    canGoBack?: boolean;
    target?: NextTarget;
  } = {},
) {
  return render(
    <AdvanceButton
      target={over.target ?? SCENE_TARGET}
      isLightMode={over.isLightMode ?? false}
      stacked={false}
      onAdvance={() => {}}
      onPrev={() => {}}
      canGoBack={over.canGoBack ?? true}
      armedAdvance={over.armedAdvance ?? false}
      armedPrev={over.armedPrev ?? false}
    />,
  );
}

function advance(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-perform-primary]') as HTMLElement;
}

function prev(container: HTMLElement): HTMLElement {
  return container.querySelectorAll('button')[0] as HTMLElement;
}

describe('the armed treatment', () => {
  it('adds nothing while no switch is held', () => {
    const { container, unmount } = renderButton();
    expect(advance(container).className).not.toContain('ring-');
    expect(prev(container).className).not.toContain('ring-');
    expect(advance(container).hasAttribute('data-armed')).toBe(false);
    unmount();
  });

  it('rings the advance button when a forward switch is armed', () => {
    const { container, unmount } = renderButton({ armedAdvance: true });
    expect(advance(container).getAttribute('data-armed')).toBe('true');
    expect(advance(container).className).toContain('ring-2');
    expect(prev(container).hasAttribute('data-armed')).toBe(false);
    unmount();
  });

  it('rings the prev button when a backward switch is armed', () => {
    const { container, unmount } = renderButton({ armedPrev: true });
    expect(prev(container).getAttribute('data-armed')).toBe('true');
    expect(advance(container).hasAttribute('data-armed')).toBe(false);
    unmount();
  });

  it('uses the dark amber that clears 3:1 on zinc-950', () => {
    const { container, unmount } = renderButton({ armedAdvance: true });
    expect(advance(container).className).toContain('ring-amber-400');
    unmount();
  });

  it('uses the light amber that clears 3:1 on slate-100', () => {
    const { container, unmount } = renderButton({
      armedAdvance: true,
      isLightMode: true,
    });
    const className = advance(container).className;
    expect(className).toContain('ring-amber-700');
    expect(className).not.toContain('ring-amber-500');
    expect(className).not.toContain('ring-amber-600');
    unmount();
  });

  it('keeps the target treatment underneath the ring', () => {
    const { container, unmount } = renderButton({ armedAdvance: true });
    expect(advance(container).className).toContain('bg-cyan-950');
    unmount();
  });

  it('offsets the ring in the perform background so it reads as separate', () => {
    const dark = renderButton({ armedAdvance: true });
    expect(advance(dark.container).className).toContain('ring-offset-zinc-950');
    dark.unmount();

    const light = renderButton({ armedAdvance: true, isLightMode: true });
    expect(advance(light.container).className).toContain(
      'ring-offset-slate-100',
    );
    light.unmount();
  });

  it('does not arm a prev button that cannot go back', () => {
    const { container, unmount } = renderButton({
      armedPrev: true,
      canGoBack: false,
    });
    expect(prev(container).hasAttribute('data-armed')).toBe(false);
    expect(prev(container).className).not.toContain('ring-');
    unmount();
  });

  it('does not arm the advance button at the end of the set', () => {
    const { container, unmount } = renderButton({
      armedAdvance: true,
      target: END_TARGET,
    });
    expect(advance(container).hasAttribute('data-armed')).toBe(false);
    expect(advance(container).className).not.toContain('ring-');
    unmount();
  });
});
