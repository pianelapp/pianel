import { act } from 'react';
import { installViewport, type FakeViewport } from '../utils/matchMedia';
import { initTestStores } from '../utils/stores';
import { resetSetlistWorld, setPianoConnected } from '../fixtures/setlists';
import { renderPerforming, stubPianoWithTones } from '../fixtures/setlistsUi';
import { useControlSurfaceStore, useCursorStore } from '../../src/store';

const TIER_WIDTH = { mobile: 400, desktop: 1400 } as const;

let viewport: FakeViewport;

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
  stubPianoWithTones([{ id: 'a', name: 'Concert Piano' }]);
  setPianoConnected(true);
  useControlSurfaceStore.getState().setHeld(null);
  viewport = installViewport(TIER_WIDTH.desktop);
});

afterEach(() => {
  viewport.restore();
  useControlSurfaceStore.getState().setHeld(null);
  useCursorStore.getState().clearAnchor();
});

function setViewport(tier: keyof typeof TIER_WIDTH): void {
  act(() => viewport.setWidth(TIER_WIDTH[tier]));
}

function layoutOf(container: HTMLElement): string | null {
  return container.querySelector('[data-layout]')!.getAttribute('data-layout');
}

describe('PerformMode wires the footswitch state into both layouts', () => {
  it('marks the peek anchor in the columns layout', async () => {
    setViewport('desktop');
    const { container } = await renderPerforming(['A', 'B', 'C']);
    expect(layoutOf(container)).toBe('columns');

    await act(async () => {
      useCursorStore.getState().setAnchor({ entryIndex: 0, sceneIndex: 2 });
    });

    const anchored = container.querySelectorAll('[data-anchor-row]');
    expect(anchored).toHaveLength(1);
    expect(anchored[0].textContent).toContain('C');
  });

  it('marks the peek anchor in the stacked layout', async () => {
    setViewport('mobile');
    const { container } = await renderPerforming(['A', 'B', 'C']);
    expect(layoutOf(container)).toBe('stacked');

    await act(async () => {
      useCursorStore.getState().setAnchor({ entryIndex: 0, sceneIndex: 2 });
    });

    const anchored = container.querySelectorAll('[data-anchor-row]');
    expect(anchored).toHaveLength(1);
    expect(anchored[0].textContent).toContain('C');
  });

  it('ignores an anchor left behind in another song', async () => {
    setViewport('desktop');
    const { container } = await renderPerforming(['A', 'B', 'C']);

    await act(async () => {
      useCursorStore.getState().setAnchor({ entryIndex: 4, sceneIndex: 2 });
    });

    expect(container.querySelectorAll('[data-anchor-row]')).toHaveLength(0);
  });

  it('arms the advance button in the columns layout', async () => {
    setViewport('desktop');
    const { container } = await renderPerforming(['A', 'B']);

    await act(async () => {
      useControlSurfaceStore
        .getState()
        .setHeld({ actionId: 'perform.nextScene', behaviour: 'release' });
    });

    expect(
      container
        .querySelector('[data-perform-primary]')!
        .getAttribute('data-armed'),
    ).toBe('true');
  });

  it('arms the advance button in the stacked layout', async () => {
    setViewport('mobile');
    const { container } = await renderPerforming(['A', 'B']);

    await act(async () => {
      useControlSurfaceStore
        .getState()
        .setHeld({ actionId: 'perform.nextSong', behaviour: 'release' });
    });

    expect(
      container
        .querySelector('[data-perform-primary]')!
        .getAttribute('data-armed'),
    ).toBe('true');
  });

  it('arms the prev button rather than the advance one', async () => {
    setViewport('desktop');
    const { container } = await renderPerforming(['A', 'B']);

    await act(async () => {
      useCursorStore.getState().setPosition({ sceneIndex: 1 });
      useControlSurfaceStore
        .getState()
        .setHeld({ actionId: 'perform.prevScene', behaviour: 'release' });
    });

    const armed = [...container.querySelectorAll('button[data-armed]')];
    expect(armed).toHaveLength(1);
    expect(armed[0].hasAttribute('data-perform-primary')).toBe(false);
  });

  it('arms the prev button in the stacked layout too', async () => {
    setViewport('mobile');
    const { container } = await renderPerforming(['A', 'B']);

    await act(async () => {
      useCursorStore.getState().setPosition({ sceneIndex: 1 });
      useControlSurfaceStore
        .getState()
        .setHeld({ actionId: 'perform.prevScene', behaviour: 'release' });
    });

    const armed = [...container.querySelectorAll('button[data-armed]')];
    expect(armed).toHaveLength(1);
    expect(armed[0].hasAttribute('data-perform-primary')).toBe(false);
  });

  it('does not arm a prev button that has nowhere to go back to', async () => {
    setViewport('desktop');
    const { container } = await renderPerforming(['A', 'B']);

    await act(async () => {
      useControlSurfaceStore
        .getState()
        .setHeld({ actionId: 'perform.prevScene', behaviour: 'release' });
    });

    expect(container.querySelectorAll('[data-armed]')).toHaveLength(0);
  });

  it('leaves both buttons alone for a press-bound switch', async () => {
    setViewport('desktop');
    const { container } = await renderPerforming(['A', 'B']);

    await act(async () => {
      useControlSurfaceStore
        .getState()
        .setHeld({ actionId: 'perform.nextScene', behaviour: 'press' });
    });

    expect(container.querySelectorAll('[data-armed]')).toHaveLength(0);
  });
});
