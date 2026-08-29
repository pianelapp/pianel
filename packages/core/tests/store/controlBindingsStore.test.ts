import {
  createControlBindingsStore,
  useControlBindingsStore,
  CONTROL_BINDINGS_VERSION,
} from '../../src/store/controlBindingsStore';
import {inMemoryStorage} from '../../src/store/storage';
import type {
  ChannelControlMessage,
  ControlMatch,
  ControlMessage,
} from '../../src/types/control';

const CC20: ControlMatch = {type: 'cc', channel: 1, id: 20};
const SYSEX: ControlMatch = {type: 'sysex', data: [0xf0, 0x41, 0x01, 0xf7]};
const CC21: ControlMatch = {type: 'cc', channel: 1, id: 21};

function message(over: Partial<ChannelControlMessage> = {}): ControlMessage {
  return {type: 'cc', channel: 1, id: 20, value: 127, ...over};
}

beforeAll(() => {
  createControlBindingsStore({storage: inMemoryStorage});
});

beforeEach(() => {
  useControlBindingsStore.getState().clearAll();
});

describe('controlBindingsStore', () => {
  it('starts with a version, no bindings and no device', () => {
    const state = useControlBindingsStore.getState();
    expect(state.version).toBe(CONTROL_BINDINGS_VERSION);
    expect(state.bindings).toEqual([]);
    expect(state.device).toBeNull();
  });

  it('adds a binding and gives it an id', () => {
    const created = useControlBindingsStore.getState().addBinding({
      match: CC20,
      actionId: 'perform.nextScene',
      behaviour: 'release',
    });

    expect(created.id).toEqual(expect.any(String));
    expect(created.id.length).toBeGreaterThan(0);
    expect(useControlBindingsStore.getState().bindings).toEqual([created]);
  });

  it('lets one action hold several bindings', () => {
    const store = useControlBindingsStore.getState();
    store.addBinding({match: CC20, actionId: 'perform.nextScene', behaviour: 'release'});
    store.addBinding({match: {type: 'cc', channel: 1, id: 22}, actionId: 'perform.nextScene', behaviour: 'peek'});

    const held = useControlBindingsStore.getState().bindingsFor('perform.nextScene');
    expect(held.map(b => b.behaviour)).toEqual(['release', 'peek']);
  });

  it('never lets one message reach two bindings', () => {
    const store = useControlBindingsStore.getState();
    store.addBinding({match: CC20, actionId: 'perform.prevScene', behaviour: 'release'});
    store.addBinding({match: CC20, actionId: 'perform.nextScene', behaviour: 'peek'});

    const bindings = useControlBindingsStore.getState().bindings;
    expect(bindings).toHaveLength(1);
    expect(bindings[0].actionId).toBe('perform.nextScene');
  });

  it('finds the binding a message belongs to, ignoring value', () => {
    const created = useControlBindingsStore.getState().addBinding({
      match: CC20,
      actionId: 'perform.nextScene',
      behaviour: 'release',
    });

    const store = useControlBindingsStore.getState();
    expect(store.findByMessage(message({value: 127}))).toEqual(created);
    expect(store.findByMessage(message({value: 0}))).toEqual(created);
  });

  it('finds nothing for an unbound message', () => {
    useControlBindingsStore.getState().addBinding({
      match: CC21,
      actionId: 'perform.nextScene',
      behaviour: 'release',
    });
    expect(useControlBindingsStore.getState().findByMessage(message())).toBeNull();
  });

  it('distinguishes type and channel, not only the number', () => {
    useControlBindingsStore.getState().addBinding({
      match: CC20,
      actionId: 'perform.nextScene',
      behaviour: 'release',
    });

    const store = useControlBindingsStore.getState();
    expect(store.findByMessage(message({type: 'note'}))).toBeNull();
    expect(store.findByMessage(message({channel: 2}))).toBeNull();
  });

  it('removes one binding by id', () => {
    const store = useControlBindingsStore.getState();
    const a = store.addBinding({match: CC20, actionId: 'perform.nextScene', behaviour: 'release'});
    const b = store.addBinding({match: CC21, actionId: 'perform.prevScene', behaviour: 'release'});

    useControlBindingsStore.getState().removeBinding(a.id);

    expect(useControlBindingsStore.getState().bindings).toEqual([b]);
  });

  it('ignores a remove for an id it does not hold', () => {
    const store = useControlBindingsStore.getState();
    store.addBinding({match: CC20, actionId: 'perform.nextScene', behaviour: 'release'});
    store.removeBinding('nope');
    expect(useControlBindingsStore.getState().bindings).toHaveLength(1);
  });

  it('keeps bindings for an action nobody registered', () => {
    useControlBindingsStore.getState().addBinding({
      match: CC20,
      actionId: 'perform.somethingRenamed',
      behaviour: 'press',
    });
    expect(useControlBindingsStore.getState().bindingsFor('perform.somethingRenamed')).toHaveLength(1);
  });

  it('stores a sysex binding keyed by its whole payload', () => {
    const created = useControlBindingsStore.getState().addBinding({
      match: SYSEX,
      actionId: 'piano.toggleMetronome',
      behaviour: 'press',
    });

    const store = useControlBindingsStore.getState();
    expect(
      store.findByMessage({
        type: 'sysex',
        data: [0xf0, 0x41, 0x01, 0xf7],
        value: 127,
      }),
    ).toEqual(created);
    expect(
      store.findByMessage({
        type: 'sysex',
        data: [0xf0, 0x41, 0x02, 0xf7],
        value: 127,
      }),
    ).toBeNull();
  });

  it('dedupes a sysex binding by payload, not by reference', () => {
    const store = useControlBindingsStore.getState();
    store.addBinding({match: SYSEX, actionId: 'perform.prevScene', behaviour: 'press'});
    store.addBinding({
      match: {type: 'sysex', data: [0xf0, 0x41, 0x01, 0xf7]},
      actionId: 'perform.nextScene',
      behaviour: 'press',
    });

    const bindings = useControlBindingsStore.getState().bindings;
    expect(bindings).toHaveLength(1);
    expect(bindings[0].actionId).toBe('perform.nextScene');
  });

  it.each([
    ['program change', {type: 'pc', channel: 1, id: 5} as ControlMatch],
    ['sysex', SYSEX],
  ])('refuses a release binding on %s, which has no release edge', (_label, match) => {
    expect(() =>
      useControlBindingsStore.getState().addBinding({
        match,
        actionId: 'perform.nextScene',
        behaviour: 'release',
      }),
    ).toThrow(/cannot/i);
    expect(useControlBindingsStore.getState().bindings).toEqual([]);
  });

  it('refuses a peek binding on a control with no release edge', () => {
    expect(() =>
      useControlBindingsStore.getState().addBinding({
        match: SYSEX,
        actionId: 'perform.nextScene',
        behaviour: 'peek',
      }),
    ).toThrow(/cannot/i);
  });

  it('still accepts press on a control with no release edge', () => {
    expect(() =>
      useControlBindingsStore.getState().addBinding({
        match: SYSEX,
        actionId: 'piano.toggleMetronome',
        behaviour: 'press',
      }),
    ).not.toThrow();
  });

  it('remembers and forgets the device', () => {
    useControlBindingsStore.getState().setDevice({id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'});
    expect(useControlBindingsStore.getState().device).toEqual({
      id: 'in-pedal',
      name: 'FootCtrlPlus Bluetooth',
    });

    useControlBindingsStore.getState().setDevice(null);
    expect(useControlBindingsStore.getState().device).toBeNull();
  });

  it('persists bindings, the device and the version under its own key', () => {
    useControlBindingsStore.getState().addBinding({
      match: CC20,
      actionId: 'perform.nextScene',
      behaviour: 'peek',
    });
    useControlBindingsStore.getState().setDevice({id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'});

    const raw = inMemoryStorage.getItem('pianel:control-bindings') as string;
    expect(typeof raw).toBe('string');
    const parsed = JSON.parse(raw);
    expect(parsed.state.version).toBe(CONTROL_BINDINGS_VERSION);
    expect(parsed.state.bindings).toHaveLength(1);
    expect(parsed.state.bindings[0].behaviour).toBe('peek');
    expect(parsed.state.device.name).toBe('FootCtrlPlus Bluetooth');
  });
});
