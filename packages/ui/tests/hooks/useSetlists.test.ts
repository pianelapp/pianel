import {renderHook, actSync} from '../utils/renderHook';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {useSetlists} from '../../src/hooks/useSetlists';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('useSetlists', () => {
  it('returns an empty list and no-ops when no service is registered', () => {
    const hook = renderHook(() => useSetlists());
    expect(hook.current.setlists).toEqual([]);
    expect(hook.current.createSetlist('Anything')).toBeNull();
    hook.unmount();
  });

  it('re-renders when a setlist gains an entry', () => {
    const {songs} = wire();
    const hook = renderHook(() => useSetlists());

    let songId = '';
    actSync(() => {
      songId = songs.createSong('Opener').id;
      songs.captureScene(songId, 'Head');
    });
    let listId = '';
    actSync(() => {
      listId = hook.current.createSetlist('Bar Gig')!.id;
    });
    actSync(() => {
      hook.current.addSong(listId, songId);
    });

    expect(hook.current.setlists[0].entries).toHaveLength(1);
    expect(hook.current.isCustomized(listId, 0)).toBe(false);
    hook.unmount();
  });

  it('reports a customized entry as customized', () => {
    const {songs} = wire();
    const hook = renderHook(() => useSetlists());

    let songId = '';
    actSync(() => {
      songId = songs.createSong('Opener').id;
      songs.captureScene(songId, 'Head');
    });
    let listId = '';
    actSync(() => {
      listId = hook.current.createSetlist('Bar Gig')!.id;
      hook.current.addSong(listId, songId);
    });
    actSync(() => {
      hook.current.customizeEntry(listId, 0);
    });

    expect(hook.current.isCustomized(listId, 0)).toBe(true);
    expect(hook.current.countSetlistsUsing(songId)).toBe(0);
    hook.unmount();
  });
});
