import {act} from 'react';
import {click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {
  byText,
  openContextMenu as openEntryMenu,
  renderList,
  type PerformStartAt,
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

  it('expands an entry through a real button that carries its expanded state', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('Opener').id;
    songs.captureScene(a, 'Intro');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);

    const {container} = renderList(listId);
    const expander = container.querySelector('[data-entry-expander]')!;
    expect(expander.tagName).toBe('BUTTON');
    expect(expander.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('Intro');

    click(expander);
    expect(expander.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Intro');

    click(expander);
    expect(expander.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not expand an entry whose library song has been deleted', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('Ghost').id;
    songs.captureScene(a, 'Vanished Scene');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);
    songs.deleteSong(a);

    const {container} = renderList(listId);
    const expander = container.querySelector('[data-entry-expander]')!;
    expect(expander.getAttribute('aria-disabled')).toBe('true');

    click(expander);
    expect(expander.getAttribute('aria-expanded')).toBeNull();
    expect(container.textContent).not.toContain('Vanished Scene');
  });

  it('starts a performance from a chosen song', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('Opener').id;
    const b = songs.createSong('Closer').id;
    songs.captureScene(a, 'x');
    songs.captureScene(b, 'y');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);
    setlists.addSong(listId, b);

    const calls: Array<[string, PerformStartAt | undefined]> = [];
    const {container} = renderList(listId, {
      onPerform: (id, startAt) => calls.push([id, startAt]),
    });
    openEntryMenu(container, 'Closer');
    click(byText(container, 'Perform from here'));

    expect(calls).toEqual([[listId, {entryIndex: 1}]]);
  });

  it('starts a performance from a chosen scene', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('Opener').id;
    const b = songs.createSong('Closer').id;
    songs.captureScene(a, 'x');
    songs.captureScene(b, 'Head');
    songs.captureScene(b, 'Solo');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);
    setlists.addSong(listId, b);

    const calls: Array<[string, PerformStartAt | undefined]> = [];
    const {container} = renderList(listId, {
      onPerform: (id, startAt) => calls.push([id, startAt]),
    });
    click(byText(container, 'Closer'));
    openEntryMenu(container, 'Solo');
    click(byText(container, 'Perform from here'));

    expect(calls).toEqual([[listId, {entryIndex: 1, sceneIndex: 1}]]);
  });

  it('offers no start point on an entry with no scenes', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('Bare').id;
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);

    const {container} = renderList(listId);
    openEntryMenu(container, 'Bare');
    expect(container.textContent).not.toContain('Perform from here');
  });

  it('offers no start point on an entry whose library song has been deleted', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('Ghost').id;
    songs.captureScene(a, 'x');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);
    songs.deleteSong(a);

    const {container} = renderList(listId);
    openEntryMenu(container, 'Missing song');
    expect(container.textContent).not.toContain('Perform from here');
  });

  it('PERFORM still starts the setlist from the top', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('Opener').id;
    songs.captureScene(a, 'x');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);

    const calls: Array<[string, PerformStartAt | undefined]> = [];
    const {container} = renderList(listId, {
      onPerform: (id, startAt) => calls.push([id, startAt]),
    });
    click(byText(container, 'PERFORM'));

    expect(calls).toEqual([[listId, undefined]]);
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
