import {act} from 'react';
import {click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {byText, renderScreen, typeInto} from '../fixtures/setlistsUi';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('song library CRUD', () => {
  it('creates a song through the naming dialog', () => {
    wire();
    const {container} = renderScreen();
    click(byText(container, 'New Song'));

    typeInto(container, 'Isn’t She Lovely');
    click(byText(container, 'Save'));

    expect(container.textContent).toContain('Isn’t She Lovely');
    expect(container.textContent).toContain('0 scenes');
  });

  it('rejects an empty song name without creating anything', () => {
    const {songs} = wire();
    const {container} = renderScreen();
    click(byText(container, 'New Song'));
    click(byText(container, 'Save'));
    expect(songs.listSongs()).toHaveLength(0);
  });

  it('leaves the dialog open with an inline error when Save is submitted blank', () => {
    wire();
    const {container} = renderScreen();
    click(byText(container, 'New Song'));
    click(byText(container, 'Save'));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('renames a song from its context menu', () => {
    const {songs} = wire();
    songs.createSong('Old Name');
    const {container} = renderScreen();

    const row = byText(container, 'Old Name');
    act(() => {
      row.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}));
    });
    click(byText(container, 'Rename'));

    typeInto(container, 'New Name');
    click(byText(container, 'Save'));

    expect(songs.listSongs()[0].name).toBe('New Name');
  });

  it('deletes a song after confirmation and clears the detail pane', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Doomed').id;
    songs.captureScene(songId, 'Only');
    const {container} = renderScreen();

    click(byText(container, 'Doomed'));
    expect(container.textContent).toContain('Only');

    const row = byText(container, 'Doomed');
    act(() => {
      row.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}));
    });
    click(byText(container, 'Delete'));
    click(byText(container, 'Delete'));

    await act(async () => {});
    expect(songs.listSongs()).toHaveLength(0);
    expect(container.textContent).not.toContain('Only');
  });

  it('warns how many setlists a song is used by before deleting', () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'A');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, songId);

    const {container} = renderScreen();
    const row = byText(container, 'Shared');
    act(() => {
      row.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}));
    });
    expect(container.textContent).toContain('in 1 setlist');
  });
});
