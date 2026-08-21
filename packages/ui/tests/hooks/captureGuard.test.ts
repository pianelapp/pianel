import {renderHook, actSync} from '../utils/renderHook';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld, setPianoConnected, setPianoStatus} from '../fixtures/setlists';
import {useSongs} from '../../src/hooks/useSongs';
import {usePresets} from '../../src/hooks/usePresets';
import type {PerformanceSnapshot, Scene} from '../../src/store';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('capture is gated on a connected piano at the hook layer', () => {
  it('captureScene returns null and writes nothing while disconnected', () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    setPianoConnected(false);

    const hook = renderHook(() => useSongs());
    let captured: Scene | null = null;
    actSync(() => {
      captured = hook.current.captureScene(songId, 'A');
    });

    expect(captured).toBeNull();
    expect(songs.getSong(songId)!.scenes).toHaveLength(0);
    hook.unmount();
  });

  it('recaptureScene reports refusal and leaves the scene untouched while disconnected', () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    songs.captureScene(songId, 'A');
    const sceneId = songs.getSong(songId)!.scenes[0].id;
    const before = songs.getSong(songId)!.scenes[0].snapshot.tempo;
    setPianoConnected(false);

    const hook = renderHook(() => useSongs());
    let accepted: Scene | null = null;
    actSync(() => {
      accepted = hook.current.recaptureScene(songId, sceneId);
    });

    expect(accepted).toBeNull();
    expect(songs.getSong(songId)!.scenes[0].snapshot.tempo).toBe(before);
    hook.unmount();
  });

  it('captureSnapshot returns null while disconnected', () => {
    wire();
    setPianoConnected(false);

    const hook = renderHook(() => usePresets());
    let snapshot: PerformanceSnapshot | null = null;
    actSync(() => {
      snapshot = hook.current.captureSnapshot();
    });

    expect(snapshot).toBeNull();
    hook.unmount();
  });

  it('lets all three through once the piano is connected', () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    setPianoConnected(true);

    const songsHook = renderHook(() => useSongs());
    const presetsHook = renderHook(() => usePresets());

    let captured: Scene | null = null;
    let accepted: Scene | null = null;
    let snapshot: PerformanceSnapshot | null = null;
    actSync(() => {
      captured = songsHook.current.captureScene(songId, 'A');
    });
    actSync(() => {
      accepted = songsHook.current.recaptureScene(
        songId,
        songs.getSong(songId)!.scenes[0].id,
      );
      snapshot = presetsHook.current.captureSnapshot();
    });

    expect(captured).not.toBeNull();
    expect(accepted).not.toBeNull();
    expect(snapshot).not.toBeNull();
    expect(songs.getSong(songId)!.scenes).toHaveLength(1);

    songsHook.unmount();
    presetsHook.unmount();
  });

  it.each(['disconnected', 'stale', 'connecting', 'scanning', 'discovered', 'idle'] as const)(
    'refuses to capture while the connection is %s',
    status => {
      const {songs} = wire();
      const songId = songs.createSong('S').id;
      setPianoStatus(status);

      const hook = renderHook(() => useSongs());
      let captured: Scene | null = null;
      actSync(() => {
        captured = hook.current.captureScene(songId, 'A');
      });

      expect(captured).toBeNull();
      expect(songs.getSong(songId)!.scenes).toHaveLength(0);
      hook.unmount();
    },
  );
});
