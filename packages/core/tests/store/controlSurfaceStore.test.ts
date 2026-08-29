import {useControlSurfaceStore} from '../../src/store/controlSurfaceStore';
import type {ControlMessage} from '../../src/types/control';

const CC20: ControlMessage = {type: 'cc', channel: 1, id: 20, value: 127};

beforeEach(() => {
  useControlSurfaceStore.getState().endLearn();
  useControlSurfaceStore.getState().setHeld(null);
  useControlSurfaceStore.getState().setAttached(false, null);
  useControlSurfaceStore.setState({lastMessage: null, lastMessageAt: null});
});

describe('controlSurfaceStore', () => {
  it('starts detached and idle', () => {
    const state = useControlSurfaceStore.getState();
    expect(state.attached).toBe(false);
    expect(state.deviceName).toBeNull();
    expect(state.held).toBeNull();
    expect(state.lastMessage).toBeNull();
    expect(state.learn.phase).toBe('idle');
  });

  it('records attachment with the device name', () => {
    useControlSurfaceStore.getState().setAttached(true, 'FootCtrlPlus Bluetooth');
    expect(useControlSurfaceStore.getState().attached).toBe(true);
    expect(useControlSurfaceStore.getState().deviceName).toBe('FootCtrlPlus Bluetooth');
  });

  it('records and clears held state', () => {
    useControlSurfaceStore.getState().setHeld({actionId: 'perform.nextScene', behaviour: 'peek'});
    expect(useControlSurfaceStore.getState().held).toEqual({
      actionId: 'perform.nextScene',
      behaviour: 'peek',
    });

    useControlSurfaceStore.getState().setHeld(null);
    expect(useControlSurfaceStore.getState().held).toBeNull();
  });

  it('remembers the last message and when it arrived', () => {
    useControlSurfaceStore.getState().noteMessage(CC20, 1000);
    expect(useControlSurfaceStore.getState().lastMessage).toEqual(CC20);
    expect(useControlSurfaceStore.getState().lastMessageAt).toBe(1000);
  });
});

describe('controlSurfaceStore learn state', () => {
  it('arms for one action with nothing captured', () => {
    useControlSurfaceStore.getState().startLearn('perform.nextScene');
    const learn = useControlSurfaceStore.getState().learn;
    expect(learn.phase).toBe('armed');
    expect(learn.actionId).toBe('perform.nextScene');
    expect(learn.captured).toBeNull();
    expect(learn.behaviours).toEqual([]);
  });

  it('moves to detecting when a message is captured', () => {
    useControlSurfaceStore.getState().startLearn('perform.nextScene');
    useControlSurfaceStore.getState().setLearnDetecting(CC20, 5_000);

    const learn = useControlSurfaceStore.getState().learn;
    expect(learn.phase).toBe('detecting');
    expect(learn.captured).toEqual(CC20);
  });

  it('moves to confirming with the behaviours on offer', () => {
    useControlSurfaceStore.getState().startLearn('perform.nextScene');
    useControlSurfaceStore.getState().setLearnDetecting(CC20, 5_000);
    useControlSurfaceStore.getState().setLearnConfirming(['press', 'release', 'peek']);

    const learn = useControlSurfaceStore.getState().learn;
    expect(learn.phase).toBe('confirming');
    expect(learn.behaviours).toEqual(['press', 'release', 'peek']);
  });

  it('carries the behaviours through a conflict so the user can continue', () => {
    useControlSurfaceStore.getState().startLearn('perform.nextScene');
    useControlSurfaceStore.getState().setLearnDetecting(CC20, 5_000);
    useControlSurfaceStore.getState().setLearnConflict('perform.prevScene', ['press', 'release']);

    const learn = useControlSurfaceStore.getState().learn;
    expect(learn.phase).toBe('conflict');
    expect(learn.conflictActionId).toBe('perform.prevScene');
    expect(learn.behaviours).toEqual(['press', 'release']);
    expect(learn.captured).toEqual(CC20);
  });

  it('times out without losing which action was being learned', () => {
    useControlSurfaceStore.getState().startLearn('perform.nextScene');
    useControlSurfaceStore.getState().setLearnTimeout();

    const learn = useControlSurfaceStore.getState().learn;
    expect(learn.phase).toBe('timeout');
    expect(learn.actionId).toBe('perform.nextScene');
  });

  it('returns to idle and forgets everything on end', () => {
    useControlSurfaceStore.getState().startLearn('perform.nextScene');
    useControlSurfaceStore.getState().setLearnDetecting(CC20, 5_000);
    useControlSurfaceStore.getState().endLearn();

    expect(useControlSurfaceStore.getState().learn).toEqual({
      phase: 'idle',
      actionId: null,
      captured: null,
      capable: [],
      behaviours: [],
      conflictActionId: null,
      releaseWindowMs: null,
    });
  });
});
