import {act} from 'react';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {byText, renderDetail, renderList} from '../fixtures/setlistsUi';
import {click} from '../utils/render';

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

function menu() {
  return document.querySelector('[role="menu"]');
}

function menuItems() {
  const m = menu();
  if (!m) throw new Error('menu not open');
  return Array.from(m.querySelectorAll('[role="menuitem"]')).map(b =>
    (b.textContent ?? '').trim(),
  );
}

function touchPointerDown(el: Element, x: number, y: number) {
  const e = new MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(e, 'pointerType', {value: 'touch'});
  Object.defineProperty(e, 'pointerId', {value: 1});
  act(() => {
    el.dispatchEvent(e);
  });
}

async function longPress(el: Element, x = 40, y = 50) {
  touchPointerDown(el, x, y);
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
}

function sceneRowFor(container: HTMLElement, label: string): HTMLElement {
  const node = byText(container, label);
  const row = node.closest('div[class*="items-center"]');
  if (!row) throw new Error(`no scene row for ${label}`);
  return row as HTMLElement;
}

describe('scene row long-press', () => {
  it('opens the scene menu at the touch point in the songs pane', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Vida Cega').id;
    songs.captureScene(songId, 'Intro');
    songs.captureScene(songId, 'Verse');

    const {container} = renderDetail(songId);
    expect(menu()).toBeNull();

    await longPress(sceneRowFor(container, 'Intro'), 120, 140);

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

    await longPress(sceneRowFor(container, 'Scene 1'), 90, 200);

    expect(menu()).not.toBeNull();
    expect(menuItems()).toContain('Rename');
    expect(menuItems()).not.toContain('Re-capture');
  });

  it('does not open the menu when the hold is released early', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Vida Cega').id;
    songs.captureScene(songId, 'Intro');

    const {container} = renderDetail(songId);
    touchPointerDown(sceneRowFor(container, 'Intro'), 40, 50);
    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    expect(menu()).toBeNull();
  });
});
