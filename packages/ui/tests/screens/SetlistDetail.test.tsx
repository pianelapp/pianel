import {act} from 'react';
import {click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {
  byText,
  openContextMenu as openEntryMenu,
  renderList,
} from '../fixtures/setlistsUi';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('SetlistDetail', () => {
  it('shows an empty setlist prompt', () => {
    const {setlists} = wire();
    const listId = setlists.createSetlist('Bar Gig').id;
    const {container} = renderList(listId);
    expect(container.textContent).toContain('No songs in this setlist');
  });

  it('adds a library song and numbers the entry', () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Opener').id;
    songs.captureScene(songId, 'A');
    const listId = setlists.createSetlist('Bar Gig').id;

    const {container} = renderList(listId);
    click(byText(container, 'Add Song'));
    click(byText(container, 'Opener'));

    expect(setlists.getSetlist(listId)!.entries).toHaveLength(1);
    expect(container.textContent).toContain('Opener');
  });

  it('moves an entry down', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('A').id;
    const b = songs.createSong('B').id;
    songs.captureScene(a, 'x');
    songs.captureScene(b, 'y');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);
    setlists.addSong(listId, b);

    const {container} = renderList(listId);
    openEntryMenu(container, 'A');
    click(byText(container, 'Move down'));

    const names = setlists
      .getSetlist(listId)!
      .entries.map(e => songs.getSong(e.songId)!.name);
    expect(names).toEqual(['B', 'A']);
  });

  it('removes an entry without deleting the library song', async () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('A').id;
    songs.captureScene(a, 'x');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);

    const {container} = renderList(listId);
    openEntryMenu(container, 'A');
    click(byText(container, 'Remove from setlist'));
    await act(async () => {});

    expect(setlists.getSetlist(listId)!.entries).toHaveLength(0);
    expect(songs.getSong(a)).not.toBeNull();
  });

  it('marks an entry whose library song has been deleted', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('Ghost').id;
    songs.captureScene(a, 'x');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);
    songs.deleteSong(a);

    const {container} = renderList(listId);
    expect(container.textContent).toContain('missing');
  });

  it('disables PERFORM on a setlist with no playable entry', () => {
    const {setlists} = wire();
    const listId = setlists.createSetlist('Empty').id;
    const {container} = renderList(listId);
    const perform = byText(container, 'PERFORM') as HTMLButtonElement;
    expect(perform.disabled).toBe(true);
  });

  it('disables PERFORM when every entry resolves to a song with no scenes', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('A').id;
    const b = songs.createSong('B').id;
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);
    setlists.addSong(listId, b);

    const {container} = renderList(listId);
    const perform = byText(container, 'PERFORM') as HTMLButtonElement;
    expect(perform.disabled).toBe(true);
  });

  it('enables PERFORM once at least one entry resolves to a playable song', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('A').id;
    const b = songs.createSong('B').id;
    songs.captureScene(b, 'x');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);
    setlists.addSong(listId, b);

    const {container} = renderList(listId);
    const perform = byText(container, 'PERFORM') as HTMLButtonElement;
    expect(perform.disabled).toBe(false);
  });
});
