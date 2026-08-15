import {click} from '../utils/render';
import {renderPicker} from '../fixtures/setlistsUi';

describe('SongPicker', () => {
  it('lists every entry in setlist order', () => {
    const {container} = renderPicker(['One', 'Two', 'Three'], 1);
    const rows = [...container.querySelectorAll('[data-entry]')];
    expect(rows.map(r => r.textContent)).toEqual([
      expect.stringContaining('One'),
      expect.stringContaining('Two'),
      expect.stringContaining('Three'),
    ]);
  });

  it('greys played entries and leaves them tappable for encores', () => {
    const onJump = jest.fn();
    const {container} = renderPicker(['One', 'Two', 'Three'], 2, onJump);
    const first = container.querySelector('[data-entry="0"]') as HTMLButtonElement;
    expect(first.dataset.played).toBe('true');
    expect(first.disabled).toBe(false);
    click(first);
    expect(onJump).toHaveBeenCalledWith(0);
  });

  it('does not mark the current or upcoming entries as played', () => {
    const {container} = renderPicker(['One', 'Two', 'Three'], 1);
    expect((container.querySelector('[data-entry="1"]') as HTMLElement).dataset.played).toBe('false');
    expect((container.querySelector('[data-entry="2"]') as HTMLElement).dataset.played).toBe('false');
  });

  it('shows scene position on the current entry only', () => {
    const {container} = renderPicker(['One', 'Two'], 0, () => {}, 2, 5);
    expect((container.querySelector('[data-entry="0"]') as HTMLElement).textContent)
      .toContain('3 / 5');
    expect((container.querySelector('[data-entry="1"]') as HTMLElement).textContent)
      .not.toContain('/');
  });

  it('badges customized entries as edited', () => {
    const {container} = renderPicker(['One'], 0, () => {}, 0, 1, [true]);
    expect(container.textContent).toContain('edited');
  });

  it('dismisses on an outside tap without jumping', () => {
    const onJump = jest.fn();
    const onClose = jest.fn();
    const {container} = renderPicker(['One', 'Two'], 0, onJump, 0, 1, [false], onClose);
    click(container.querySelector('[data-picker-scrim]')!);
    expect(onClose).toHaveBeenCalled();
    expect(onJump).not.toHaveBeenCalled();
  });
});
