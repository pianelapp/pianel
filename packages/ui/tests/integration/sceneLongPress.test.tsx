import {act} from 'react';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {byText, renderDetail, renderList} from '../fixtures/setlistsUi';
import {click} from '../utils/render';
import {
  menu,
  menuItems,
  touchPointerDown,
  touchPointerUp,
  longPress,
} from '../utils/longPress';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('scene row long-press', () => {
  it('opens the scene menu at the touch point in the songs pane', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Vida Cega').id;
    songs.captureScene(songId, 'Intro');
    songs.captureScene(songId, 'Verse');

    const {container} = renderDetail(songId);
    expect(menu()).toBeNull();

    await longPress(byText(container, 'Intro'), 120, 140);

    expect(menu()).not.toBeNull();
    expect(menuItems()).toContain('Rename');
    const el = menu() as HTMLElement;
    expect(el.style.top).toBe('140px');
    expect(el.style.left).toBe('120px');
  });

  it('opens the scene menu on a scene nested inside a setlist entry', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('No Lugar').id;
    songs.captureScene(songId, 'Scene 1');
    const listId = setlists.createSetlist('Ensaio').id;
    setlists.addSong(listId, songId);

    const {container} = renderList(listId);
    click(byText(container, 'No Lugar'));
    expect(menu()).toBeNull();

    await longPress(byText(container, 'Scene 1'), 90, 200);

    expect(menu()).not.toBeNull();
    expect(menuItems()).toContain('Rename');
    expect(menuItems()).toContain('Re-capture');
  });

  it('does not open the menu when the hold is released early', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Vida Cega').id;
    songs.captureScene(songId, 'Intro');

    const {container} = renderDetail(songId);
    const row = byText(container, 'Intro');
    touchPointerDown(row);
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    touchPointerUp(row);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(menu()).toBeNull();
  });
});
