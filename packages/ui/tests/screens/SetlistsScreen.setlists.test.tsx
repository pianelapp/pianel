import {act} from 'react';
import {click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {byText, openContextMenu, renderScreen, typeInto} from '../fixtures/setlistsUi';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('setlist CRUD', () => {
  it('creates a setlist through the naming dialog', () => {
    const {setlists} = wire();
    const {container} = renderScreen();

    click(byText(container, 'Setlists'));
    click(byText(container, 'New Setlist'));
    typeInto(container, 'Bar Gig');
    click(byText(container, 'Save'));

    expect(setlists.listSetlists().map(s => s.name)).toEqual(['Bar Gig']);
    expect(container.textContent).toContain('Bar Gig');
    expect(container.textContent).toContain('0 songs');
  });

  it('offers no New Setlist action while the Songs pane is showing', () => {
    wire();
    const {container} = renderScreen();
    expect(container.textContent).toContain('New Song');
    expect(container.textContent).not.toContain('New Setlist');
  });

  it('rejects an empty setlist name without creating anything', () => {
    const {setlists} = wire();
    const {container} = renderScreen();

    click(byText(container, 'Setlists'));
    click(byText(container, 'New Setlist'));
    click(byText(container, 'Save'));

    expect(setlists.listSetlists()).toHaveLength(0);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('selects a newly created setlist to reach its detail pane', () => {
    wire();
    const {container} = renderScreen();

    click(byText(container, 'Setlists'));
    click(byText(container, 'New Setlist'));
    typeInto(container, 'Bar Gig');
    click(byText(container, 'Save'));
    click(byText(container, 'Bar Gig'));

    expect(container.textContent).toContain('No songs in this setlist');
    expect(container.textContent).toContain('Add Song');
  });

  it('renames a setlist from its context menu', () => {
    const {setlists} = wire();
    setlists.createSetlist('Old Gig');
    const {container} = renderScreen();

    click(byText(container, 'Setlists'));
    openContextMenu(container, 'Old Gig');
    click(byText(container, 'Rename'));
    typeInto(container, 'New Gig');
    click(byText(container, 'Save'));

    expect(setlists.listSetlists()[0].name).toBe('New Gig');
  });

  it('deletes a setlist after confirmation', async () => {
    const {setlists} = wire();
    setlists.createSetlist('Doomed Gig');
    const {container} = renderScreen();

    click(byText(container, 'Setlists'));
    openContextMenu(container, 'Doomed Gig');
    click(byText(container, 'Delete'));
    expect(container.textContent).toContain('Delete "Doomed Gig"?');
    click(byText(container, 'Delete'));
    await act(async () => {});

    expect(setlists.listSetlists()).toHaveLength(0);
    expect(container.textContent).toContain('No setlists yet');
  });

  it('keeps the setlist when the delete confirmation is cancelled', async () => {
    const {setlists} = wire();
    setlists.createSetlist('Kept Gig');
    const {container} = renderScreen();

    click(byText(container, 'Setlists'));
    openContextMenu(container, 'Kept Gig');
    click(byText(container, 'Delete'));
    click(byText(container, 'Cancel'));
    await act(async () => {});

    expect(setlists.listSetlists()).toHaveLength(1);
  });

  it('leaves the library songs intact when a setlist is deleted', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Superstition').id;
    songs.captureScene(songId, 'Intro');
    const listId = setlists.createSetlist('Doomed Gig').id;
    setlists.addSong(listId, songId);
    const {container} = renderScreen();

    click(byText(container, 'Setlists'));
    openContextMenu(container, 'Doomed Gig');
    click(byText(container, 'Delete'));
    click(byText(container, 'Delete'));
    await act(async () => {});

    expect(setlists.listSetlists()).toHaveLength(0);
    expect(songs.listSongs().map(s => s.name)).toEqual(['Superstition']);
    expect(songs.getSong(songId)!.scenes).toHaveLength(1);
  });
});
