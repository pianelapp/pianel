import {click, keydown, render, type RenderResult} from '../utils/render';
import {
  LibraryEditDialog,
  type LibraryEditChoice,
} from '../../src/screens/setlists/LibraryEditDialog';

function renderDialog(
  overrides: Partial<{
    songName: string;
    setlistName: string;
    actionLabel: string;
    followedElsewhere: boolean;
  }> = {},
  onChoose: (choice: LibraryEditChoice, remember: boolean) => void = () => {},
): RenderResult {
  return render(
    <LibraryEditDialog
      songName={overrides.songName ?? 'Isn’t She Lovely'}
      setlistName={overrides.setlistName ?? 'Bar Gig'}
      actionLabel={overrides.actionLabel ?? 'Reordering this scene'}
      followedElsewhere={overrides.followedElsewhere ?? true}
      isLightMode={false}
      onChoose={onChoose}
    />,
  );
}

describe('LibraryEditDialog', () => {
  it('names the song, the gig and the action', () => {
    const {container} = renderDialog({
      songName: 'Isn’t She Lovely',
      setlistName: 'Bar Gig',
      actionLabel: 'Deleting this scene',
    });
    expect(container.textContent).toContain('Isn’t She Lovely');
    expect(container.textContent).toContain('Bar Gig');
    expect(container.textContent).toContain('Deleting this scene');
  });

  it('offers exactly two action buttons', () => {
    const {container} = renderDialog();
    expect(container.querySelectorAll('[data-dialog-action]')).toHaveLength(2);
  });

  it('reports thisGig and everywhere from the two buttons', () => {
    const a = jest.fn();
    const first = renderDialog({}, a);
    click(first.container.querySelector('[data-dialog-action="thisGig"]')!);
    expect(a).toHaveBeenCalledWith('thisGig', false);

    const b = jest.fn();
    const second = renderDialog({}, b);
    click(second.container.querySelector('[data-dialog-action="everywhere"]')!);
    expect(b).toHaveBeenCalledWith('everywhere', false);
  });

  it.each([
    ['the close button', '[data-dialog-close]'],
    ['the backdrop', '[data-dialog-scrim]'],
  ])('cancels from %s', (_l, selector) => {
    const onChoose = jest.fn();
    const {container} = renderDialog({}, onChoose);
    click(container.querySelector(selector)!);
    expect(onChoose).toHaveBeenCalledWith('cancel', false);
  });

  it('cancels on Escape', () => {
    const onChoose = jest.fn();
    renderDialog({}, onChoose);
    keydown('Escape');
    expect(onChoose).toHaveBeenCalledWith('cancel', false);
  });

  it('does not cancel when the click lands inside the panel', () => {
    const onChoose = jest.fn();
    const {container} = renderDialog({}, onChoose);
    click(container.querySelector('[data-dialog-panel]')!);
    expect(onChoose).not.toHaveBeenCalled();
  });
  it('names the library rather than other setlists when nothing else follows the song', () => {
    const {container} = renderDialog({followedElsewhere: false});
    expect(container.textContent).toContain('changes the song in your library');
    expect(container.textContent).not.toContain('every setlist that follows it');
  });

  it('names the following setlists when the song is shared', () => {
    const {container} = renderDialog({followedElsewhere: true});
    expect(container.textContent).toContain('every setlist that follows it');
    expect(container.textContent).not.toContain('changes the song in your library');
  });
  it('passes the remember flag with the chosen action once ticked', () => {
    const onChoose = jest.fn();
    const {container} = renderDialog({}, onChoose);

    click(container.querySelector('[data-dialog-remember]')!);
    click(container.querySelector('[data-dialog-action="thisGig"]')!);

    expect(onChoose).toHaveBeenCalledWith('thisGig', true);
  });

  it('never remembers a cancel, even when the box is ticked', () => {
    const onChoose = jest.fn();
    const {container} = renderDialog({}, onChoose);

    click(container.querySelector('[data-dialog-remember]')!);
    click(container.querySelector('[data-dialog-close]')!);

    expect(onChoose).toHaveBeenCalledWith('cancel', false);
  });
});
