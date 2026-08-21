import {act} from 'react';
import {click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld, setPianoConnected} from '../fixtures/setlists';
import {
  byText,
  openContextMenu as openSceneMenu,
  renderList,
  typeInto,
} from '../fixtures/setlistsUi';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('editing a song from inside a setlist', () => {
  it('expands an entry to show its scenes', () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Isn’t She Lovely').id;
    songs.captureScene(songId, 'Intro');
    songs.captureScene(songId, 'Chorus');
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);

    const {container} = renderList(listId);
    expect(container.textContent).not.toContain('Intro');
    click(byText(container, 'Isn’t She Lovely'));
    expect(container.textContent).toContain('Intro');
    expect(container.textContent).toContain('Chorus');
  });

  it('only this gig detaches this entry and leaves the library and other setlists alone', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    const bar = setlists.createSetlist('Bar Gig').id;
    const wed = setlists.createSetlist('Wedding Set').id;
    setlists.addSong(bar, songId);
    setlists.addSong(wed, songId);

    const {container} = renderList(bar);
    click(byText(container, 'Shared'));
    openSceneMenu(container, 'A');
    click(byText(container, 'Move down'));
    click(container.querySelector('[data-dialog-action="thisGig"]')!);
    await act(async () => {});

    expect(setlists.isCustomized(bar, 0)).toBe(true);
    expect(setlists.resolveEntry(bar, 0)!.scenes.map(s => s.label)).toEqual(['B', 'A']);
    expect(songs.getSong(songId)!.scenes.map(s => s.label)).toEqual(['A', 'B']);
    expect(setlists.isCustomized(wed, 0)).toBe(false);
    expect(setlists.resolveEntry(wed, 0)!.scenes.map(s => s.label)).toEqual(['A', 'B']);
  });

  it('update everywhere edits the library and detaches nothing', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    const bar = setlists.createSetlist('Bar Gig').id;
    const wed = setlists.createSetlist('Wedding Set').id;
    setlists.addSong(bar, songId);
    setlists.addSong(wed, songId);

    const {container} = renderList(bar);
    click(byText(container, 'Shared'));
    openSceneMenu(container, 'A');
    click(byText(container, 'Move down'));
    click(container.querySelector('[data-dialog-action="everywhere"]')!);
    await act(async () => {});

    expect(songs.getSong(songId)!.scenes.map(s => s.label)).toEqual(['B', 'A']);
    expect(setlists.isCustomized(bar, 0)).toBe(false);
    expect(setlists.resolveEntry(wed, 0)!.scenes.map(s => s.label)).toEqual(['B', 'A']);

    const sceneA = byText(container, 'A');
    const sceneB = byText(container, 'B');
    expect(
      sceneA.compareDocumentPosition(sceneB) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });

  it('cancelling changes nothing anywhere', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    const bar = setlists.createSetlist('Bar Gig').id;
    const wed = setlists.createSetlist('Wedding Set').id;
    setlists.addSong(bar, songId);
    setlists.addSong(wed, songId);

    const {container} = renderList(bar);
    click(byText(container, 'Shared'));
    openSceneMenu(container, 'A');
    click(byText(container, 'Move down'));
    click(container.querySelector('[data-dialog-close]')!);
    await act(async () => {});

    expect(songs.getSong(songId)!.scenes.map(s => s.label)).toEqual(['A', 'B']);
    expect(setlists.isCustomized(bar, 0)).toBe(false);
  });

  it('does not ask again once the entry is already detached', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    const bar = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(bar, songId);
    setlists.customizeEntry(bar, 0);

    const {container} = renderList(bar);
    click(byText(container, 'Shared'));
    openSceneMenu(container, 'A');
    click(byText(container, 'Move down'));
    await act(async () => {});

    expect(container.querySelector('[data-dialog-panel]')).toBeNull();
    expect(setlists.resolveEntry(bar, 0)!.scenes.map(s => s.label)).toEqual(['B', 'A']);
    expect(songs.getSong(songId)!.scenes.map(s => s.label)).toEqual(['A', 'B']);
  });

  it('does not ask when the song is only used in this one entry', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Solo').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    const bar = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(bar, songId);

    const {container} = renderList(bar);
    click(byText(container, 'Solo'));
    openSceneMenu(container, 'A');
    click(byText(container, 'Move down'));
    await act(async () => {});

    expect(container.querySelector('[data-dialog-panel]')).toBeNull();
    expect(setlists.isCustomized(bar, 0)).toBe(false);
    expect(songs.getSong(songId)!.scenes.map(s => s.label)).toEqual(['B', 'A']);
  });

  it('gates a rename from inside a setlist too', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'Old');
    const bar = setlists.createSetlist('Bar Gig').id;
    const wed = setlists.createSetlist('Wedding Set').id;
    setlists.addSong(bar, songId);
    setlists.addSong(wed, songId);

    const {container} = renderList(bar);
    click(byText(container, 'Shared'));
    openSceneMenu(container, 'Old');
    click(byText(container, 'Rename'));
    typeInto(container, 'New');
    click(byText(container, 'Save'));

    expect(container.querySelector('[data-dialog-panel]')).not.toBeNull();
    expect(container.textContent).toContain('Bar Gig');

    click(container.querySelector('[data-dialog-action="thisGig"]')!);
    await act(async () => {});

    expect(setlists.resolveEntry(bar, 0)!.scenes[0].label).toBe('New');
    expect(songs.getSong(songId)!.scenes[0].label).toBe('Old');
  });

  it('offers Re-capture on a setlist-embedded scene', () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'A');
    const bar = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(bar, songId);

    const {container} = renderList(bar);
    click(byText(container, 'Shared'));
    openSceneMenu(container, 'A');

    expect(container.textContent).toContain('Re-capture');
  });

  it('re-captures a setlist-embedded scene into the library when nothing else uses it', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Solo').id;
    songs.captureScene(songId, 'A');
    const before = songs.getSong(songId)!.scenes[0].snapshot.tempo;
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);

    const {container} = renderList(listId);
    click(byText(container, 'Solo'));
    openSceneMenu(container, 'A');
    click(byText(container, 'Re-capture'));
    click(byText(container, 'Re-capture'));
    await act(async () => {});

    expect(songs.getSong(songId)!.scenes[0].snapshot.tempo).not.toBe(before);
  });

  it('re-captures onto the detached copy only, leaving the library untouched', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'A');
    const before = songs.getSong(songId)!.scenes[0].snapshot.tempo;
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
    setlists.customizeEntry(listId, 0);

    const {container} = renderList(listId);
    click(byText(container, 'Shared'));
    openSceneMenu(container, 'A');
    click(byText(container, 'Re-capture'));
    click(byText(container, 'Re-capture'));
    await act(async () => {});

    expect(setlists.resolveEntry(listId, 0)!.scenes[0].snapshot.tempo).not.toBe(before);
    expect(songs.getSong(songId)!.scenes[0].snapshot.tempo).toBe(before);
  });

  it('re-captures onto a fresh detached copy when the song is shared and this gig is chosen', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'A');
    const before = songs.getSong(songId)!.scenes[0].snapshot.tempo;
    const sceneId = songs.getSong(songId)!.scenes[0].id;
    const bar = setlists.createSetlist('Bar Gig').id;
    const club = setlists.createSetlist('Club Gig').id;
    setlists.addSong(bar, songId);
    setlists.addSong(club, songId);

    const {container} = renderList(bar);
    click(byText(container, 'Shared'));
    openSceneMenu(container, 'A');
    click(byText(container, 'Re-capture'));
    click(byText(container, 'Re-capture'));
    await act(async () => {});

    const thisGig = container.querySelector('[data-dialog-action="thisGig"]');
    expect(thisGig).not.toBeNull();
    click(thisGig as HTMLElement);
    await act(async () => {});

    expect(setlists.isCustomized(bar, 0)).toBe(true);
    const override = setlists.resolveEntry(bar, 0)!;
    expect(override.scenes[0].id).toBe(sceneId);
    expect(override.scenes[0].snapshot.tempo).not.toBe(before);
    expect(songs.getSong(songId)!.scenes[0].snapshot.tempo).toBe(before);
    expect(setlists.resolveEntry(club, 0)!.scenes[0].snapshot.tempo).toBe(before);
  });

  it('refuses to re-capture a setlist-embedded scene while disconnected', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Solo').id;
    songs.captureScene(songId, 'A');
    const before = songs.getSong(songId)!.scenes[0].snapshot.tempo;
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);

    const {container} = renderList(listId);
    click(byText(container, 'Solo'));
    setPianoConnected(false);
    openSceneMenu(container, 'A');
    click(byText(container, 'Re-capture'));
    await act(async () => {});

    expect(container.textContent).toContain('Piano not connected');
    expect(songs.getSong(songId)!.scenes[0].snapshot.tempo).toBe(before);
  });

  it('does not expand a dangling entry', () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Gone').id;
    songs.captureScene(songId, 'OnlyScene');
    const bar = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(bar, songId);
    songs.deleteSong(songId);

    const {container} = renderList(bar);
    click(byText(container, 'Missing song'));

    expect(container.textContent).not.toContain('OnlyScene');
  });
});
