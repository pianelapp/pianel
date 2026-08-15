import {initTestStores} from '../utils/stores';
import {click} from '../utils/render';
import {
  byText,
  renderRail,
  renderRailWithScenes,
  railAt,
  stubPianoWithTones,
} from '../fixtures/setlistsUi';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  stubPianoWithTones([
    {id: 'a', name: 'Concert Piano'},
    {id: 'c', name: 'Acoustic Bass'},
  ]);
});

describe('SceneRail', () => {
  it('lists every scene with its number and sound', () => {
    const {container} = renderRail(['Intro', 'Verse', 'Clav'], 0);
    expect(container.textContent).toContain('Intro');
    expect(container.textContent).toContain('Verse');
    expect(container.textContent).toContain('Clav');
  });

  it('shows each row its own sound, right of the label', () => {
    const {container} = renderRailWithScenes(
      [
        {label: 'Intro', voiceMode: 'single', rightToneId: 'a'},
        {label: 'Chorus', voiceMode: 'split', rightToneId: 'a', leftToneId: 'c'},
      ],
      0,
    );
    const rows = [...container.querySelectorAll('[data-scene-row]')];
    expect(rows[0].textContent).toContain('Concert Piano');
    expect(rows[1].textContent).toContain('SPLIT');
  });

  it('marks the current row and only that row', () => {
    const {container} = renderRail(['A', 'B', 'C'], 1);
    const current = container.querySelectorAll('[data-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('B');
  });

  it('jumps when a row is tapped', () => {
    const onJump = jest.fn();
    const {container} = renderRail(['A', 'B', 'C'], 0, onJump);
    click(byText(container, 'C'));
    expect(onJump).toHaveBeenCalledWith(2);
  });

  it('gives every row at least the 44px tap floor', () => {
    const {container} = renderRail(['A'], 0);
    expect(container.querySelector('button')!.className).toContain('tap-target');
  });

  it('scrolls the current row into view when the cursor moves', () => {
    const spy = jest.fn();
    Element.prototype.scrollIntoView = spy;
    const {rerender} = renderRail(['A', 'B', 'C'], 0);
    spy.mockClear();
    rerender(railAt(['A', 'B', 'C'], 2));
    expect(spy).toHaveBeenCalled();
  });
});
