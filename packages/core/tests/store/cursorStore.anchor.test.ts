import {useCursorStore} from '../../src/store/cursorStore';

beforeEach(() => {
  useCursorStore.getState().exit();
});

describe('cursorStore anchor', () => {
  it('starts null', () => {
    expect(useCursorStore.getState().anchor).toBeNull();
  });

  it('records where a peek started', () => {
    useCursorStore.getState().enter({setlistId: 'l1', songId: 's1', entryIndex: 2});
    useCursorStore.getState().setAnchor({entryIndex: 2, sceneIndex: 3});

    expect(useCursorStore.getState().anchor).toEqual({entryIndex: 2, sceneIndex: 3});
  });

  it('survives the cursor moving', () => {
    useCursorStore.getState().enter({setlistId: 'l1', songId: 's1', entryIndex: 0});
    useCursorStore.getState().setAnchor({entryIndex: 0, sceneIndex: 1});
    useCursorStore.getState().setPosition({sceneIndex: 2});

    expect(useCursorStore.getState().anchor).toEqual({entryIndex: 0, sceneIndex: 1});
    expect(useCursorStore.getState().sceneIndex).toBe(2);
  });

  it('clears on demand', () => {
    useCursorStore.getState().setAnchor({entryIndex: 0, sceneIndex: 1});
    useCursorStore.getState().clearAnchor();
    expect(useCursorStore.getState().anchor).toBeNull();
  });

  it('clears when perform is exited', () => {
    useCursorStore.getState().enter({setlistId: null, songId: 's1', entryIndex: 0});
    useCursorStore.getState().setAnchor({entryIndex: 0, sceneIndex: 1});

    useCursorStore.getState().exit();

    expect(useCursorStore.getState().anchor).toBeNull();
  });

  it('clears when perform is entered afresh', () => {
    useCursorStore.getState().setAnchor({entryIndex: 0, sceneIndex: 1});
    useCursorStore.getState().enter({setlistId: null, songId: 's2', entryIndex: 0});
    expect(useCursorStore.getState().anchor).toBeNull();
  });
});
