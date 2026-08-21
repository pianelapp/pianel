import {useCursorStore} from '../../src/store/cursorStore';

describe('cursorStore', () => {
  beforeEach(() => {
    useCursorStore.getState().exit();
  });

  it('starts idle', () => {
    const s = useCursorStore.getState();
    expect(s.isPerforming).toBe(false);
    expect(s.setlistId).toBeNull();
    expect(s.songId).toBe('');
    expect(s.entryIndex).toBe(0);
    expect(s.sceneIndex).toBe(0);
  });

  it('enter sets the full position and marks performing', () => {
    useCursorStore.getState().enter({
      setlistId: 'list-1',
      songId: 'song-1',
      entryIndex: 2,
    });
    const s = useCursorStore.getState();
    expect(s.isPerforming).toBe(true);
    expect(s.setlistId).toBe('list-1');
    expect(s.songId).toBe('song-1');
    expect(s.entryIndex).toBe(2);
    expect(s.sceneIndex).toBe(0);
  });

  it('enter with a null setlistId supports the single-song path', () => {
    useCursorStore.getState().enter({setlistId: null, songId: 'song-9', entryIndex: 0});
    expect(useCursorStore.getState().setlistId).toBeNull();
    expect(useCursorStore.getState().songId).toBe('song-9');
  });

  it('enter with null setlistId and nonzero entryIndex pins entryIndex to 0', () => {
    useCursorStore.getState().enter({setlistId: null, songId: 'song-9', entryIndex: 5});
    const s = useCursorStore.getState();
    expect(s.setlistId).toBeNull();
    expect(s.entryIndex).toBe(0);
  });

  it('enter with a real setlistId preserves the given entryIndex', () => {
    useCursorStore.getState().enter({setlistId: 'list-1', songId: 'song-1', entryIndex: 3});
    expect(useCursorStore.getState().entryIndex).toBe(3);
  });

  it('setPosition updates sceneIndex alone', () => {
    useCursorStore.getState().enter({setlistId: 'l', songId: 's', entryIndex: 0});
    useCursorStore.getState().setPosition({sceneIndex: 3});
    expect(useCursorStore.getState().sceneIndex).toBe(3);
    expect(useCursorStore.getState().songId).toBe('s');
  });

  it('setPosition can move song and entry together', () => {
    useCursorStore.getState().enter({setlistId: 'l', songId: 's1', entryIndex: 0});
    useCursorStore.getState().setPosition({songId: 's2', entryIndex: 1, sceneIndex: 0});
    const s = useCursorStore.getState();
    expect(s.songId).toBe('s2');
    expect(s.entryIndex).toBe(1);
    expect(s.sceneIndex).toBe(0);
  });

  it('exit clears everything', () => {
    useCursorStore.getState().enter({setlistId: 'l', songId: 's', entryIndex: 4});
    useCursorStore.getState().setPosition({sceneIndex: 2});
    useCursorStore.getState().exit();
    const s = useCursorStore.getState();
    expect(s.isPerforming).toBe(false);
    expect(s.setlistId).toBeNull();
    expect(s.songId).toBe('');
    expect(s.entryIndex).toBe(0);
    expect(s.sceneIndex).toBe(0);
  });
});
