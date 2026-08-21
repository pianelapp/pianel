import {act} from 'react';
import {click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {byText, openContextMenu, renderDetail, typeInto} from '../fixtures/setlistsUi';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('library edit gate on the SONGS pane', () => {
  it('does not ask when no setlist follows the song', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Solo Song').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    const {container} = renderDetail(songId);

    openContextMenu(container, 'A');
    click(byText(container, 'Move down'));
    await act(async () => {});

    expect(songs.getSong(songId)!.scenes.map(s => s.label)).toEqual(['B', 'A']);
  });

  it('names the affected setlists before a sound-changing edit', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    const one = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(one, songId);
    const {container} = renderDetail(songId);

    openContextMenu(container, 'A');
    click(byText(container, 'Move down'));

    expect(container.textContent).toContain('Bar Gig');
  });

  it('cancelling leaves the song untouched', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    const one = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(one, songId);
    const {container} = renderDetail(songId);

    openContextMenu(container, 'A');
    click(byText(container, 'Move down'));
    click(byText(container, 'Cancel'));
    await act(async () => {});

    expect(songs.getSong(songId)!.scenes.map(s => s.label)).toEqual(['A', 'B']);
  });

  it('confirming edits the library and the setlist follows', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    const one = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(one, songId);
    const {container} = renderDetail(songId);

    openContextMenu(container, 'A');
    click(byText(container, 'Move down'));
    click(byText(container, 'Update'));
    await act(async () => {});

    expect(songs.getSong(songId)!.scenes.map(s => s.label)).toEqual(['B', 'A']);
    expect(setlists.resolveEntry(one, 0)!.scenes.map(s => s.label)).toEqual(['B', 'A']);
  });

  it('gates a rename too, not just sound changes', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'Old');
    const one = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(one, songId);
    const {container} = renderDetail(songId);

    openContextMenu(container, 'Old');
    click(byText(container, 'Rename'));
    typeInto(container, 'New');
    click(byText(container, 'Save'));

    expect(container.textContent).toContain('Bar Gig');
  });

  it('does not gate an edit to a song only detached setlists reference', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    const one = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(one, songId);
    setlists.customizeEntry(one, 0);
    const {container} = renderDetail(songId);

    openContextMenu(container, 'A');
    click(byText(container, 'Move down'));
    await act(async () => {});

    expect(songs.getSong(songId)!.scenes.map(s => s.label)).toEqual(['B', 'A']);
  });
});
