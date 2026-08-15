import {act} from 'react';
import {renderHook} from '../utils/renderHook';
import {initTestStores} from '../utils/stores';
import {useProfilesStore} from '../../src/store';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {usePerformCursor} from '../../src/hooks/usePerformCursor';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('usePerformCursor', () => {
  it('does not throw when no profile is active', () => {
    wire();
    useProfilesStore.setState({profiles: [], activeProfileId: ''});

    const hook = renderHook(() => usePerformCursor());

    expect(hook.current.song).toBeNull();
    expect(hook.current.scene).toBeNull();
    expect(hook.current.nextTarget).toEqual({kind: 'end'});
    expect(hook.current.isPerforming).toBe(false);
    hook.unmount();
  });

  it('does not throw when no service is registered', () => {
    const hook = renderHook(() => usePerformCursor());
    expect(hook.current.song).toBeNull();
    expect(hook.current.nextTarget).toEqual({kind: 'end'});
    hook.unmount();
  });

  it('does not throw when the active profile disappears mid-performance', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Nocturne').id;
    songs.captureScene(songId, 'Theme');

    const hook = renderHook(() => usePerformCursor());
    await act(async () => {
      await hook.current.enterSong(songId);
    });
    expect(hook.current.isPerforming).toBe(true);
    expect(hook.current.song).not.toBeNull();
    expect(hook.current.scene).not.toBeNull();

    act(() => {
      useProfilesStore.setState({profiles: [], activeProfileId: ''});
    });

    expect(hook.current.song).toBeNull();
    expect(hook.current.scene).toBeNull();
    expect(hook.current.nextTarget).toEqual({kind: 'end'});
    hook.unmount();
  });

  it('reflects a scene rename made through SongService without an explicit rerender', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Waltz').id;
    const scene = songs.captureScene(songId, 'Verse')!;

    const hook = renderHook(() => usePerformCursor());
    await act(async () => {
      await hook.current.enterSong(songId);
    });
    expect(hook.current.scene?.label).toBe('Verse');

    act(() => {
      songs.renameScene(songId, scene.id, 'Bridge');
    });

    expect(hook.current.scene?.label).toBe('Bridge');
    hook.unmount();
  });

  it('re-renders on every cursor move and reports the next target', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Superstition').id;
    songs.captureScene(songId, 'Intro');
    songs.captureScene(songId, 'Verse');
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);

    const hook = renderHook(() => usePerformCursor());

    await act(async () => {
      await hook.current.enterSetlist(listId);
    });
    expect(hook.current.isPerforming).toBe(true);
    expect(hook.current.scene?.label).toBe('Intro');
    expect(hook.current.nextTarget).toEqual({
      kind: 'scene',
      scene: expect.objectContaining({label: 'Verse'}),
    });

    await act(async () => {
      await hook.current.nextScene();
    });
    expect(hook.current.sceneIndex).toBe(1);
    expect(hook.current.scene?.label).toBe('Verse');
    expect(hook.current.nextTarget).toEqual({kind: 'end'});
    hook.unmount();
  });

  it('reports a song target at a song boundary', async () => {
    const {songs, setlists} = wire();
    const first = songs.createSong('Opener').id;
    songs.captureScene(first, 'Head');
    const second = songs.createSong('Closer').id;
    songs.captureScene(second, 'Head');
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, first);
    setlists.addSong(listId, second);

    const hook = renderHook(() => usePerformCursor());
    await act(async () => {
      await hook.current.enterSetlist(listId);
    });

    expect(hook.current.nextTarget).toEqual({
      kind: 'song',
      song: expect.objectContaining({name: 'Closer'}),
    });
    hook.unmount();
  });

  it('exit clears isPerforming', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Rehearsal').id;
    songs.captureScene(songId, 'A');

    const hook = renderHook(() => usePerformCursor());
    await act(async () => {
      await hook.current.enterSong(songId);
    });
    expect(hook.current.isPerforming).toBe(true);

    act(() => {
      hook.current.exit();
    });
    expect(hook.current.isPerforming).toBe(false);
    expect(hook.current.song).toBeNull();
    hook.unmount();
  });
});
