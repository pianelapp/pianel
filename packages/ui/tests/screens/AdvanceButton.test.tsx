import {render, click} from '../utils/render';
import {byText} from '../fixtures/setlistsUi';
import {AdvanceButton} from '../../src/screens/perform/AdvanceButton';
import {DEFAULT_PERFORMANCE_SNAPSHOT} from '../../src/store';
import type {NextTarget} from '../../src/hooks/usePerformCursor';

const SCENE = {
  id: 's1', label: 'Clav', notes: '',
  snapshot: DEFAULT_PERFORMANCE_SNAPSHOT,
  createdAt: 'x', updatedAt: 'x',
};

const SONG = {
  id: 'song1', name: 'Isnt She Lovely', notes: '', scenes: [SCENE],
  createdAt: 'x', updatedAt: 'x',
};

function primaryOf(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-perform-primary]') as HTMLButtonElement;
}

function renderButton(
  target: NextTarget,
  onAdvance = jest.fn(),
  stacked = false,
) {
  const r = render(
    <AdvanceButton
      target={target}
      isLightMode={false}
      stacked={stacked}
      onAdvance={onAdvance}
      onPrev={() => {}}
      canGoBack
    />,
  );
  return {...r, onAdvance};
}

describe('AdvanceButton', () => {
  it('names the next scene mid-song', () => {
    const {container} = renderButton({kind: 'scene', scene: SCENE});
    expect(container.textContent).toContain('NEXT');
    expect(container.textContent).toContain('Clav');
  });

  it('names the next song and its scene count at a boundary', () => {
    const {container} = renderButton({
      kind: 'song',
      song: {...SONG, name: 'Superstition', scenes: [SCENE, SCENE, SCENE]},
    });
    expect(container.textContent).toContain('NEXT SONG');
    expect(container.textContent).toContain('Superstition');
    expect(container.textContent).toContain('3 scenes');
  });

  it('is filled at a song boundary and outlined mid-song', () => {
    const mid = renderButton({kind: 'scene', scene: SCENE});
    const boundary = renderButton({kind: 'song', song: SONG});
    const midClass = primaryOf(mid.container).className;
    const boundaryClass = primaryOf(boundary.container).className;
    expect(midClass).not.toBe(boundaryClass);
    expect(boundaryClass).toContain('bg-cyan-400');
    expect(midClass).not.toContain('bg-cyan-400');
  });

  it('is inert at the end of the set', () => {
    const {container, onAdvance} = renderButton({kind: 'end'});
    const primary = primaryOf(container) as HTMLButtonElement;
    expect(container.textContent).toContain('END OF SET');
    expect(primary.disabled).toBe(true);
    click(primary);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('fires onAdvance in both live states', () => {
    for (const target of [
      {kind: 'scene', scene: SCENE} as const,
      {kind: 'song', song: SONG} as const,
    ]) {
      const {container, onAdvance} = renderButton(target);
      click(primaryOf(container));
      expect(onAdvance).toHaveBeenCalledTimes(1);
    }
  });

  it('gives PREV less width than the primary button', () => {
    const {container} = renderButton({kind: 'scene', scene: SCENE});
    const prev = byText(container, 'PREV') as HTMLButtonElement;
    const primary = primaryOf(container);
    expect(prev.className).toContain('w-');
    expect(primary.className).toContain('flex-1');
  });

  it('disables PREV at the very start', () => {
    const {container} = render(
      <AdvanceButton
        target={{kind: 'scene', scene: SCENE}}
        isLightMode={false}
        stacked={false}
        onAdvance={() => {}}
        onPrev={() => {}}
        canGoBack={false}
      />,
    );
    expect((byText(container, 'PREV') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('AdvanceButton stacked layout', () => {
  it('lays the label above the name and folds the scene count onto it', () => {
    const {container} = renderButton({kind: 'song', song: SONG}, jest.fn(), true);
    const primary = primaryOf(container);
    const spans = [...primary.querySelectorAll('span')];
    const key = spans.find(el => (el.textContent ?? '').startsWith('NEXT SONG'));
    const value = spans.find(el => (el.textContent ?? '').trim() === SONG.name);

    expect(primary.className).toContain('flex-col');
    expect(value).toBeDefined();
    expect(value!.parentElement).toBe(primary);
    expect(key!.textContent).toContain('scene');
    expect(value!.textContent).not.toContain('scene');
  });

  it('keeps the row layout when not stacked', () => {
    const {container} = renderButton({kind: 'song', song: SONG});
    const primary = primaryOf(container);
    expect(primary.className).not.toContain('flex-col');
    const value = [...primary.querySelectorAll('span')].find(
      el => (el.textContent ?? '').trim() === SONG.name,
    );
    expect(value!.parentElement).not.toBe(primary);
  });
});
