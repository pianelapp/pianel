import {renderHook, actSync} from '../utils/renderHook';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {useSongs} from '../../src/hooks/useSongs';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('useSongs', () => {
  it('returns an empty library and no-ops when no service is registered', () => {
    const hook = renderHook(() => useSongs());
    expect(hook.current.songs).toEqual([]);
    expect(hook.current.createSong('Anything')).toBeNull();
    expect(() => hook.current.deleteSong('nope')).not.toThrow();
  });

  it('re-renders when a song is created through the service', () => {
    wire();
    const hook = renderHook(() => useSongs());
    expect(hook.current.songs).toHaveLength(0);

    actSync(() => {
      hook.current.createSong('Isn’t She Lovely');
    });

    expect(hook.current.songs).toHaveLength(1);
    expect(hook.current.songs[0].name).toBe('Isn’t She Lovely');
  });

  it('re-renders when a scene is captured into an existing song', () => {
    wire();
    const hook = renderHook(() => useSongs());
    let songId = '';
    actSync(() => {
      songId = hook.current.createSong('Superstition')!.id;
    });
    actSync(() => {
      hook.current.captureScene(songId, 'Intro');
    });
    expect(hook.current.songs[0].scenes.map(s => s.label)).toEqual(['Intro']);
  });

  it('returns the same library array identity when nothing changed', () => {
    wire();
    const hook = renderHook(() => useSongs());
    const first = hook.current.songs;
    hook.rerender();
    expect(hook.current.songs).toBe(first);
  });
});
