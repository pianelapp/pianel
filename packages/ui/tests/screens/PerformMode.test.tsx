import {act} from 'react';
import {click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {byText, renderPerform} from '../fixtures/setlistsUi';
import {useCursorStore, usePerformanceStore} from '../../src/store';
import {getCursorService} from '../../src/hooks/usePerformCursor';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('PerformMode', () => {
  it('renders nothing when not performing', () => {
    wire();
    const {container} = renderPerform({isLightMode: false});
    expect(container.textContent).toBe('');
  });

  it('takes over the screen when the cursor enters a setlist', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Superstition').id;
    songs.captureScene(songId, 'Intro');
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);

    const {container} = renderPerform({isLightMode: false});
    await act(async () => {
      await getCursorService()!.enterPerform({setlistId: listId});
    });

    expect(container.textContent).toContain('Superstition');
    expect(container.textContent).toContain('SCENE 1 / 1');
    expect(container.textContent).toContain('EXIT');
  });

  it('EXIT leaves perform mode', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Rehearsal').id;
    songs.captureScene(songId, 'A');

    const {container} = renderPerform({isLightMode: false});
    await act(async () => {
      await getCursorService()!.enterPerform({songId});
    });
    click(byText(container, 'EXIT'));

    expect(useCursorStore.getState().isPerforming).toBe(false);
    expect(container.textContent).toBe('');
  });

  it('follows a cursor move made outside React', async () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    songs.captureScene(songId, 'One');
    songs.captureScene(songId, 'Two');

    const {container} = renderPerform({isLightMode: false});
    await act(async () => {
      await getCursorService()!.enterPerform({songId});
    });
    expect(container.textContent).toContain('SCENE 1 / 2');

    await act(async () => {
      await getCursorService()!.nextScene();
    });
    expect(container.textContent).toContain('SCENE 2 / 2');
  });

  it('crosses a song boundary when PREV is pressed at the first scene of a later song', async () => {
    const {songs, setlists} = wire();
    const song1Id = songs.createSong('Sir Duke').id;
    songs.captureScene(song1Id, 'Intro');
    const song2Id = songs.createSong('Superstition').id;
    songs.captureScene(song2Id, 'Riff');
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, song1Id);
    setlists.addSong(listId, song2Id);

    const {container} = renderPerform({isLightMode: false});
    await act(async () => {
      await getCursorService()!.enterPerform({setlistId: listId});
    });
    await act(async () => {
      await getCursorService()!.nextSong();
    });
    expect(container.textContent).toContain('Superstition');

    click(byText(container, 'PREV'));

    expect(useCursorStore.getState().entryIndex).toBe(0);
    expect(useCursorStore.getState().songId).toBe(song1Id);
  });

  it('disables PREV when opening on a later song because the earlier one is scene-less', async () => {
    const {songs, setlists} = wire();
    const emptyId = songs.createSong('Empty').id;
    const songId = songs.createSong('Superstition').id;
    songs.captureScene(songId, 'Intro');
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, emptyId);
    setlists.addSong(listId, songId);

    const {container} = renderPerform({isLightMode: false});
    await act(async () => {
      await getCursorService()!.enterPerform({setlistId: listId});
    });

    expect(useCursorStore.getState().entryIndex).toBe(1);
    const prev = byText(container, 'PREV') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  it('does not make the title tappable in single-song mode', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Rehearsal').id;
    songs.captureScene(songId, 'A');

    const {container} = renderPerform({isLightMode: false});
    await act(async () => {
      await getCursorService()!.enterPerform({songId});
    });

    expect(container.querySelector('[data-song-title]')).toBeNull();
    expect(container.querySelector('[data-song-detached]')).toBeNull();
  });

  it('renders a tappable title carrying data-song-title in setlist mode', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Superstition').id;
    songs.captureScene(songId, 'Intro');
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);

    const {container} = renderPerform({isLightMode: false});
    await act(async () => {
      await getCursorService()!.enterPerform({setlistId: listId});
    });

    const title = container.querySelector('[data-song-title]');
    expect(title).not.toBeNull();
    expect(title!.tagName).toBe('BUTTON');
  });

  it('shows a library rename in the song picker without leaving perform mode', async () => {
    const {songs, setlists} = wire();
    const first = songs.createSong('Sir Duke').id;
    songs.captureScene(first, 'Intro');
    const second = songs.createSong('Old Title').id;
    songs.captureScene(second, 'Riff');
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, first);
    setlists.addSong(listId, second);

    const {container} = renderPerform({isLightMode: false});
    await act(async () => {
      await getCursorService()!.enterPerform({setlistId: listId});
    });

    act(() => {
      songs.renameSong(second, 'New Title');
    });
    click(container.querySelector('[data-song-title]')!);

    const picker = container.querySelector('[data-picker-panel]')!;
    expect(picker.textContent).toContain('New Title');
    expect(picker.textContent).not.toContain('Old Title');
  });

  it('shows an amber detached marker when the current entry is customized', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Overjoyed').id;
    songs.captureScene(songId, 'Intro');
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
    setlists.customizeEntry(listId, 0);

    const {container} = renderPerform({isLightMode: false});
    await act(async () => {
      await getCursorService()!.enterPerform({setlistId: listId});
    });

    const marker = container.querySelector('[data-song-detached]');
    expect(marker).not.toBeNull();
    expect(marker!.textContent).toBe('detached');
  });

  it('hides the detached marker when the current entry is not customized', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Sir Duke').id;
    songs.captureScene(songId, 'Intro');
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);

    const {container} = renderPerform({isLightMode: false});
    await act(async () => {
      await getCursorService()!.enterPerform({setlistId: listId});
    });

    expect(container.querySelector('[data-song-detached]')).toBeNull();
  });

  it('marks the scene modified when live performance state diverges from the captured snapshot', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Rehearsal').id;
    songs.captureScene(songId, 'A');

    const {container} = renderPerform({isLightMode: false});
    await act(async () => {
      await getCursorService()!.enterPerform({songId});
    });

    expect(container.querySelector('[data-scene-modified]')).toBeNull();

    act(() => {
      usePerformanceStore.setState({
        activeTone: {
          id: 'x',
          name: 'Test Tone',
          category: 0,
          categoryName: 'Piano',
          indexHigh: 0,
          indexLow: 0,
          position: 0,
          isGM2: false,
        },
      });
    });
    expect(container.querySelector('[data-scene-modified]')).not.toBeNull();

    act(() => {
      usePerformanceStore.setState({activeTone: null});
    });
    expect(container.querySelector('[data-scene-modified]')).toBeNull();
  });
});
