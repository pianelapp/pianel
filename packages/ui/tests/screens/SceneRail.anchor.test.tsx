import { initTestStores } from '../utils/stores';
import { renderRail, stubPianoWithTones } from '../fixtures/setlistsUi';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  stubPianoWithTones([{ id: 'a', name: 'Concert Piano' }]);
});

describe('the peek anchor marker', () => {
  it('shows nothing extra when no peek is held', () => {
    const { container } = renderRail(['A', 'B', 'C'], 1);
    expect(container.querySelectorAll('[data-anchor-row]')).toHaveLength(0);
  });

  it('marks exactly the row a release will snap back to', () => {
    const { container } = renderRail(['A', 'B', 'C'], 2, () => {}, 0);
    const anchored = container.querySelectorAll('[data-anchor-row]');

    expect(anchored).toHaveLength(1);
    expect(anchored[0].textContent).toContain('A');
  });

  it('keeps the current-row marker on the current row', () => {
    const { container } = renderRail(['A', 'B', 'C'], 2, () => {}, 0);
    const current = container.querySelectorAll('[data-current="true"]');

    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('C');
    expect(current[0].hasAttribute('data-anchor-row')).toBe(false);
  });

  it('marks the anchor on a different edge from the current row', () => {
    const { container } = renderRail(['A', 'B'], 1, () => {}, 0);
    const bar = container.querySelector('[data-anchor-bar]')!;
    const current = container.querySelector('[data-current="true"]')!;

    expect(bar.className).toContain('right-0');
    expect(current.className).toContain('shadow-[inset_3px_0_0]');
  });

  it('labels the anchor so it does not rely on colour alone', () => {
    const { container } = renderRail(['A', 'B'], 1, () => {}, 0);
    expect(container.querySelector('[data-anchor-row]')!.textContent).toContain(
      'HOLD',
    );
  });

  it('spells the label out for screen readers, which cannot see the bar', () => {
    const { container } = renderRail(['A', 'B'], 1, () => {}, 0);
    const note = container.querySelector('[data-anchor-row] .sr-only')!;

    expect(note).not.toBeNull();
    expect(note.textContent).toContain('release');
  });

  it('hides the decorative bar from screen readers', () => {
    const { container } = renderRail(['A', 'B'], 1, () => {}, 0);
    expect(
      container.querySelector('[data-anchor-bar]')!.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('paints the bar with an amber that clears 3:1, not a lighter one', () => {
    const { container } = renderRail(['A', 'B'], 1, () => {}, 0);
    const bar = container.querySelector('[data-anchor-bar]')!;

    expect(bar.className).toContain('bg-amber-400');
    expect(bar.className).not.toContain('bg-amber-500');
    expect(bar.className).not.toContain('bg-amber-600');
  });

  it('does not colour the bar from the row text, which is grey', () => {
    const { container } = renderRail(['A', 'B'], 1, () => {}, 0);
    const row = container.querySelector('[data-anchor-row]')!;

    expect(row.className).not.toContain('shadow-[inset_-3px_0_0]');
  });

  it('never marks the current row as its own anchor', () => {
    const { container } = renderRail(['A', 'B'], 1, () => {}, 1);
    expect(container.querySelectorAll('[data-anchor-row]')).toHaveLength(0);
  });

  it('ignores an anchor index outside the scene list', () => {
    const { container } = renderRail(['A', 'B'], 0, () => {}, 7);
    expect(container.querySelectorAll('[data-anchor-row]')).toHaveLength(0);
  });
});
