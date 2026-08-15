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

describe('per-gig overrides', () => {
  it('customizing an entry badges it and detaches it from the library', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('Shared').id;
    songs.captureScene(a, 'Original');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);

    const {container} = renderList(listId);
    openEntryMenu(container, 'Shared');
    click(byText(container, 'Customize for this gig'));

    expect(container.textContent).toContain('edited');
    act(() => {
      songs.renameScene(a, songs.getSong(a)!.scenes[0].id, 'Library Only');
    });
    expect(setlists.resolveEntry(listId, 0)!.scenes[0].label).toBe('Original');
  });

  it('reverting discards the gig version', async () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('Shared').id;
    songs.captureScene(a, 'Original');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);
    setlists.customizeEntry(listId, 0);

    const {container} = renderList(listId);
    openEntryMenu(container, 'Shared');
    click(byText(container, 'Revert to library version'));
    click(byText(container, 'Revert'));
    await act(async () => {});

    expect(setlists.isCustomized(listId, 0)).toBe(false);
    expect(container.textContent).not.toContain('edited');
  });

  it('promoting pushes the gig version back to the library', async () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('Shared').id;
    songs.captureScene(a, 'Original');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);
    setlists.customizeEntry(listId, 0);
    setlists.editOverride(listId, 0, song => ({
      ...song,
      scenes: [{...song.scenes[0], label: 'Gig Version'}],
    }));

    const {container} = renderList(listId);
    openEntryMenu(container, 'Shared');
    click(byText(container, 'Push changes to library'));
    click(byText(container, 'Push'));
    await act(async () => {});

    expect(songs.getSong(a)!.scenes[0].label).toBe('Gig Version');
    expect(setlists.isCustomized(listId, 0)).toBe(false);
  });

  it('offers Customize on a plain entry and the two detach verbs only on a customized one', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('Shared').id;
    songs.captureScene(a, 'x');
    const listId = setlists.createSetlist('Gig').id;
    setlists.addSong(listId, a);

    const {container} = renderList(listId);
    openEntryMenu(container, 'Shared');
    expect(container.textContent).toContain('Customize for this gig');
    expect(container.textContent).not.toContain('Revert to library version');
    expect(container.textContent).not.toContain('Push changes to library');
  });

  it('shows how many other setlists share an uncustomized song', () => {
    const {songs, setlists} = wire();
    const a = songs.createSong('Shared').id;
    songs.captureScene(a, 'x');
    const one = setlists.createSetlist('Gig One').id;
    const two = setlists.createSetlist('Gig Two').id;
    setlists.addSong(one, a);
    setlists.addSong(two, a);

    const {container} = renderList(one);
    expect(container.textContent).toContain('2 setlists follow this');
  });
});
