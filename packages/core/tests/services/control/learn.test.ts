import {controlWorld, makeAction} from '../../fixtures/controlSurface';
import {useControlBindingsStore} from '../../../src/store/controlBindingsStore';
import {useControlSurfaceStore} from '../../../src/store/controlSurfaceStore';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

function learn() {
  const world = controlWorld({learnTimeoutMs: 10_000, releaseWindowMs: 2_000});
  world.registry.register(makeAction('perform.nextScene'));
  world.registry.register(makeAction('perform.prevScene'));
  world.registry.register(
    makeAction('piano.toggleMetronome', {group: 'Piano', behaviours: ['press']}),
  );
  return world;
}

function recordWindows() {
  const windows: Array<number | null> = [];
  const unsubscribe = useControlSurfaceStore.subscribe(state =>
    windows.push(state.learn.releaseWindowMs),
  );
  return {
    stop: () => {
      unsubscribe();
      return windows;
    },
  };
}

describe('the release window', () => {
  it('defaults to five seconds so the countdown is not a blink', async () => {
    const world = controlWorld();
    world.registry.register(makeAction('perform.nextScene'));
    world.service.startLearn('perform.nextScene');

    world.transport.emit([0xb0, 0x14, 0x7f]);
    await world.service.whenIdle();

    expect(useControlSurfaceStore.getState().learn.releaseWindowMs).toBe(5_000);

    jest.advanceTimersByTime(4_999);
    expect(useControlSurfaceStore.getState().learn.phase).toBe('detecting');

    jest.advanceTimersByTime(1);
    expect(useControlSurfaceStore.getState().learn.phase).toBe('confirming');
    await world.service.destroy();
  });

  it('publishes the window so the dialog can count it down', async () => {
    const {service, transport} = learn();
    service.startLearn('perform.nextScene');

    transport.emit([0xb0, 0x14, 0x7f]);
    await service.whenIdle();

    expect(useControlSurfaceStore.getState().learn.releaseWindowMs).toBe(2_000);
    await service.destroy();
  });

  it('does not open a countdown for a message that can never carry a release', async () => {
    const {service, transport} = learn();
    const seen = recordWindows();
    service.startLearn('perform.nextScene');

    transport.emit([0xc0, 0x05]);
    await service.whenIdle();

    expect(seen.stop().some(window => window !== null)).toBe(false);
    expect(useControlSurfaceStore.getState().learn.phase).toBe('confirming');
    await service.destroy();
  });

  it('opens the countdown for a switch that could still send a release', async () => {
    const {service, transport} = learn();
    const seen = recordWindows();
    service.startLearn('perform.nextScene');

    transport.emit([0xb0, 0x14, 0x7f]);
    await service.whenIdle();

    expect(seen.stop()).toContain(2_000);
    await service.destroy();
  });

  it('clears the window once the release arrives', async () => {
    const {service, transport} = learn();
    service.startLearn('perform.nextScene');

    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x14, 0x00]);
    await service.whenIdle();

    expect(useControlSurfaceStore.getState().learn.releaseWindowMs).toBeNull();
    await service.destroy();
  });
});

describe('what the switch can do, separately from what the action accepts', () => {
  it('records the full capability even when the action only takes press', async () => {
    const {service, transport} = learn();
    service.startLearn('piano.toggleMetronome');

    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x14, 0x00]);
    await service.whenIdle();

    const state = useControlSurfaceStore.getState().learn;
    expect(state.behaviours).toEqual(['press']);
    expect(state.capable).toEqual(['press', 'release', 'peek']);
    await service.destroy();
  });

  it('records press-only capability when no release ever arrives', async () => {
    const {service, transport} = learn();
    service.startLearn('perform.nextScene');

    transport.emit([0xb0, 0x14, 0x7f]);
    await service.whenIdle();
    jest.advanceTimersByTime(2_000);

    expect(useControlSurfaceStore.getState().learn.capable).toEqual(['press']);
    await service.destroy();
  });

  it('keeps the capability through a conflict reassignment', async () => {
    const {service, transport} = learn();
    useControlBindingsStore.getState().addBinding({
      match: {type: 'cc', channel: 1, id: 20},
      actionId: 'perform.prevScene',
      behaviour: 'press',
    });
    service.startLearn('piano.toggleMetronome');

    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x14, 0x00]);
    await service.whenIdle();
    expect(useControlSurfaceStore.getState().learn.phase).toBe('conflict');

    service.acceptConflict();

    const state = useControlSurfaceStore.getState().learn;
    expect(state.phase).toBe('confirming');
    expect(state.capable).toEqual(['press', 'release', 'peek']);
    await service.destroy();
  });
});

describe('learn mode capture', () => {
  it('arms for one action', async () => {
    const {service} = learn();
    service.startLearn('perform.nextScene');

    const state = useControlSurfaceStore.getState().learn;
    expect(state.phase).toBe('armed');
    expect(state.actionId).toBe('perform.nextScene');
    await service.destroy();
  });

  it('captures the first real message and starts detecting', async () => {
    const {service, transport} = learn();
    service.startLearn('perform.nextScene');

    transport.emit([0xb0, 0x14, 0x7f]);
    await service.whenIdle();

    const state = useControlSurfaceStore.getState().learn;
    expect(state.phase).toBe('detecting');
    expect(state.captured).toEqual({type: 'cc', channel: 1, id: 20, value: 127});
    await service.destroy();
  });

  it('does not capture clock or active sensing', async () => {
    const {service, transport} = learn();
    service.startLearn('perform.nextScene');

    transport.emit([0xf8]);
    transport.emit([0xfe]);
    await service.whenIdle();

    expect(useControlSurfaceStore.getState().learn.phase).toBe('armed');
    await service.destroy();
  });

  it('offers all three behaviours when a matching release arrives', async () => {
    const {service, transport} = learn();
    service.startLearn('perform.nextScene');

    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x14, 0x00]);
    await service.whenIdle();

    const state = useControlSurfaceStore.getState().learn;
    expect(state.phase).toBe('confirming');
    expect(state.behaviours).toEqual(['press', 'release', 'peek']);
    await service.destroy();
  });

  it('offers press only when no release arrives inside the window', async () => {
    const {service, transport} = learn();
    service.startLearn('perform.nextScene');

    transport.emit([0xb0, 0x14, 0x7f]);
    await service.whenIdle();
    jest.advanceTimersByTime(2_000);
    await service.whenIdle();

    const state = useControlSurfaceStore.getState().learn;
    expect(state.phase).toBe('confirming');
    expect(state.behaviours).toEqual(['press']);
    await service.destroy();
  });

  it('offers press only for a switch sending sysex, without waiting', async () => {
    const {service, transport} = learn();
    service.startLearn('perform.nextScene');

    transport.emit([0xf0, 0x41, 0x01, 0xf7]);
    await service.whenIdle();

    const state = useControlSurfaceStore.getState().learn;
    expect(state.phase).toBe('confirming');
    expect(state.behaviours).toEqual(['press']);
    await service.destroy();
  });

  it('offers press only for a switch sending program change', async () => {
    const {service, transport} = learn();
    service.startLearn('perform.nextScene');

    transport.emit([0xc0, 0x05]);
    await service.whenIdle();

    const state = useControlSurfaceStore.getState().learn;
    expect(state.phase).toBe('confirming');
    expect(state.behaviours).toEqual(['press']);
    await service.destroy();
  });

  it('ignores a release from a different switch while detecting', async () => {
    const {service, transport} = learn();
    service.startLearn('perform.nextScene');

    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x15, 0x00]);
    await service.whenIdle();

    expect(useControlSurfaceStore.getState().learn.phase).toBe('detecting');
    await service.destroy();
  });

  it('narrows the offer to what the action itself supports', async () => {
    const {service, transport} = learn();
    service.startLearn('piano.toggleMetronome');

    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x14, 0x00]);
    await service.whenIdle();

    expect(useControlSurfaceStore.getState().learn.behaviours).toEqual(['press']);
    await service.destroy();
  });

  it('times out so a sleeping pedal cannot strand the dialog', async () => {
    const {service} = learn();
    service.startLearn('perform.nextScene');

    jest.advanceTimersByTime(10_000);

    const state = useControlSurfaceStore.getState().learn;
    expect(state.phase).toBe('timeout');
    expect(state.actionId).toBe('perform.nextScene');
    await service.destroy();
  });

  it('does not time out once a message has been captured', async () => {
    const {service, transport} = learn();
    service.startLearn('perform.nextScene');

    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x14, 0x00]);
    await service.whenIdle();
    jest.advanceTimersByTime(20_000);

    expect(useControlSurfaceStore.getState().learn.phase).toBe('confirming');
    await service.destroy();
  });
});

describe('learn mode suppression', () => {
  it('does not fire an existing binding on the switch being rebound', async () => {
    const {service, registry, transport, bind} = learn();
    const action = registry.get('perform.nextScene') as ReturnType<typeof makeAction>;
    bind('perform.nextScene', 'press');

    service.startLearn('perform.prevScene');
    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x14, 0x00]);
    await service.whenIdle();

    expect(action.run).not.toHaveBeenCalled();
    await service.destroy();
  });

  it('clears a switch that was already held when learn started', async () => {
    const {service, bind, press} = learn();
    bind('perform.nextScene', 'peek');

    await press();
    expect(useControlSurfaceStore.getState().held).not.toBeNull();

    service.startLearn('perform.prevScene');
    await service.whenIdle();

    expect(useControlSurfaceStore.getState().held).toBeNull();
    await service.destroy();
  });

  it('resumes normal dispatch after cancelling', async () => {
    const {service, registry, bind, press, tick} = learn();
    const action = registry.get('perform.nextScene') as ReturnType<typeof makeAction>;
    bind('perform.nextScene', 'press');

    service.startLearn('perform.prevScene');
    service.cancelLearn();

    tick(500);
    await press();

    expect(action.run).toHaveBeenCalledTimes(1);
    expect(useControlSurfaceStore.getState().learn.phase).toBe('idle');
    await service.destroy();
  });
});

describe('learn mode saving', () => {
  it('writes the binding the user confirmed', async () => {
    const {service, transport} = learn();
    service.startLearn('perform.nextScene');
    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x14, 0x00]);
    await service.whenIdle();

    service.confirmLearn('peek');

    const bindings = useControlBindingsStore.getState().bindings;
    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({
      actionId: 'perform.nextScene',
      behaviour: 'peek',
      match: {type: 'cc', channel: 1, id: 20},
    });
    expect(useControlSurfaceStore.getState().learn.phase).toBe('idle');
    await service.destroy();
  });

  it('refuses a behaviour that was not on offer', async () => {
    const {service, transport} = learn();
    service.startLearn('piano.toggleMetronome');
    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x14, 0x00]);
    await service.whenIdle();

    service.confirmLearn('peek');

    expect(useControlBindingsStore.getState().bindings).toEqual([]);
    await service.destroy();
  });

  it('reports a conflict instead of silently stealing the switch', async () => {
    const {service, transport, bind} = learn();
    bind('perform.prevScene', 'release');

    service.startLearn('perform.nextScene');
    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x14, 0x00]);
    await service.whenIdle();

    const state = useControlSurfaceStore.getState().learn;
    expect(state.phase).toBe('conflict');
    expect(state.conflictActionId).toBe('perform.prevScene');
    expect(state.behaviours).toEqual(['press', 'release', 'peek']);
    expect(useControlBindingsStore.getState().bindings).toHaveLength(1);
    await service.destroy();
  });

  it('reassigns when the conflict is accepted', async () => {
    const {service, transport, bind} = learn();
    bind('perform.prevScene', 'release');

    service.startLearn('perform.nextScene');
    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x14, 0x00]);
    await service.whenIdle();

    service.acceptConflict();
    expect(useControlSurfaceStore.getState().learn.phase).toBe('confirming');

    service.confirmLearn('release');

    const bindings = useControlBindingsStore.getState().bindings;
    expect(bindings).toHaveLength(1);
    expect(bindings[0].actionId).toBe('perform.nextScene');
    await service.destroy();
  });

  it('leaves the original binding alone when the conflict is declined', async () => {
    const {service, transport, bind} = learn();
    bind('perform.prevScene', 'release');

    service.startLearn('perform.nextScene');
    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x14, 0x00]);
    await service.whenIdle();

    service.cancelLearn();

    const bindings = useControlBindingsStore.getState().bindings;
    expect(bindings).toHaveLength(1);
    expect(bindings[0].actionId).toBe('perform.prevScene');
    await service.destroy();
  });

  it('cancels cleanly when the action disappeared mid-learn', async () => {
    const {service, registry, transport} = learn();
    service.startLearn('perform.nextScene');
    registry.clear();

    transport.emit([0xb0, 0x14, 0x7f]);
    transport.emit([0xb0, 0x14, 0x00]);
    await service.whenIdle();

    expect(useControlSurfaceStore.getState().learn.phase).toBe('idle');
    expect(useControlBindingsStore.getState().bindings).toEqual([]);
    await service.destroy();
  });
});
