import {act} from 'react';
import {renderHook} from '../utils/renderHook';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {usePerformCursor} from '../../src/hooks/usePerformCursor';
import {useCursorStore} from '../../src/store';
import type {PeekHandle} from '@pianel/core/types/control';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

async function performing(sceneLabels: string[]) {
  const wired = wire();
  const {songs, cursor} = wired;
  const songId = songs.createSong('Song').id;
  for (const label of sceneLabels) songs.captureScene(songId, label);
  const hook = renderHook(() => usePerformCursor());
  await act(async () => {
    await cursor.enterPerform({songId});
  });
  return {hook, songId, wired};
}

describe('beginScenePeek', () => {
  it('anchors where it started and moves forward', async () => {
    const {hook} = await performing(['A', 'B', 'C']);

    let handle: PeekHandle | null = null;
    await act(async () => {
      handle = await hook.current.beginScenePeek(1);
    });

    expect(handle).not.toBeNull();
    expect(useCursorStore.getState().sceneIndex).toBe(1);
    expect(useCursorStore.getState().anchor).toEqual({entryIndex: 0, sceneIndex: 0});
    hook.unmount();
  });

  it('snaps back exactly on end and drops the anchor', async () => {
    const {hook} = await performing(['A', 'B', 'C']);
    await act(async () => {
      await hook.current.jumpToScene(2);
    });

    let handle: PeekHandle | null = null;
    await act(async () => {
      handle = await hook.current.beginScenePeek(-1);
    });
    expect(useCursorStore.getState().sceneIndex).toBe(1);

    await act(async () => {
      await handle!.end();
    });

    expect(useCursorStore.getState().sceneIndex).toBe(2);
    expect(useCursorStore.getState().anchor).toBeNull();
    hook.unmount();
  });

  it('returns a handle at a boundary but does not move or leave an anchor', async () => {
    const {hook, wired} = await performing(['A']);
    const applied = jest.spyOn(wired.preset, 'applySnapshot');

    let handle: PeekHandle | null = null;
    await act(async () => {
      handle = await hook.current.beginScenePeek(1);
    });

    expect(handle).not.toBeNull();
    expect(useCursorStore.getState().sceneIndex).toBe(0);
    expect(useCursorStore.getState().anchor).toBeNull();

    const before = applied.mock.calls.length;
    await act(async () => {
      await handle!.end();
    });
    expect(useCursorStore.getState().sceneIndex).toBe(0);
    expect(applied.mock.calls.length).toBe(before);
    applied.mockRestore();
    hook.unmount();
  });

  it('declines when nothing is being performed', async () => {
    wire();
    const hook = renderHook(() => usePerformCursor());

    let handle: PeekHandle | null = null;
    await act(async () => {
      handle = await hook.current.beginScenePeek(1);
    });

    expect(handle).toBeNull();
    expect(useCursorStore.getState().anchor).toBeNull();
    hook.unmount();
  });

  it('does not resurrect the cursor when perform was exited mid-hold', async () => {
    const {hook} = await performing(['A', 'B', 'C']);

    let handle: PeekHandle | null = null;
    await act(async () => {
      handle = await hook.current.beginScenePeek(1);
    });

    await act(async () => {
      hook.current.exit();
      await handle!.end();
    });

    expect(useCursorStore.getState().isPerforming).toBe(false);
    expect(useCursorStore.getState().anchor).toBeNull();
    hook.unmount();
  });

  it('does not snap back into a song entered after perform was left mid-hold', async () => {
    const {hook, wired} = await performing(['A', 'B', 'C']);
    await act(async () => {
      await hook.current.jumpToScene(2);
    });

    let handle: PeekHandle | null = null;
    await act(async () => {
      handle = await hook.current.beginScenePeek(-1);
    });

    const other = wired.songs.createSong('Other').id;
    for (const label of ['X', 'Y', 'Z']) wired.songs.captureScene(other, label);

    await act(async () => {
      hook.current.exit();
      await wired.cursor.enterPerform({songId: other});
      await handle!.end();
    });

    expect(useCursorStore.getState().songId).toBe(other);
    expect(useCursorStore.getState().sceneIndex).toBe(0);
    hook.unmount();
  });

  it('does not snap back into a repeat of the same song later in the set', async () => {
    const {songs, setlists, cursor} = wire();
    const listId = setlists.createSetlist('Gig').id;
    const songId = songs.createSong('Encore').id;
    for (const label of ['A', 'B', 'C']) songs.captureScene(songId, label);
    setlists.addSong(listId, songId);
    setlists.addSong(listId, songId);

    const hook = renderHook(() => usePerformCursor());
    await act(async () => {
      await cursor.enterPerform({setlistId: listId});
      await hook.current.jumpToScene(2);
    });

    let handle: PeekHandle | null = null;
    await act(async () => {
      handle = await hook.current.beginScenePeek(-1);
    });
    expect(useCursorStore.getState().sceneIndex).toBe(1);

    await act(async () => {
      await hook.current.nextSong();
      await handle!.end();
    });

    expect(useCursorStore.getState().entryIndex).toBe(1);
    expect(useCursorStore.getState().sceneIndex).toBe(0);
    hook.unmount();
  });

  it('does not snap back into a different song', async () => {
    const {songs, setlists, cursor} = wire();
    const listId = setlists.createSetlist('Gig').id;
    for (const name of ['One', 'Two']) {
      const id = songs.createSong(name).id;
      for (const label of ['A', 'B', 'C']) songs.captureScene(id, label);
      setlists.addSong(listId, id);
    }
    const hook = renderHook(() => usePerformCursor());
    await act(async () => {
      await cursor.enterPerform({setlistId: listId});
      await hook.current.jumpToScene(2);
    });

    let handle: PeekHandle | null = null;
    await act(async () => {
      handle = await hook.current.beginScenePeek(-1);
    });
    expect(useCursorStore.getState().sceneIndex).toBe(1);

    await act(async () => {
      await hook.current.nextSong();
      await handle!.end();
    });

    expect(useCursorStore.getState().entryIndex).toBe(1);
    expect(useCursorStore.getState().sceneIndex).toBe(0);
    hook.unmount();
  });
});
