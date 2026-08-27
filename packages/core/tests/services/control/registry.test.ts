import {
  ControlActionRegistry,
  getControlActionRegistry,
  resetControlActionRegistry,
} from '../../../src/services/control/registry';
import type {ControlAction} from '../../../src/types/control';

function action(id: string, over: Partial<ControlAction> = {}): ControlAction {
  return {
    id,
    label: id,
    group: 'Perform',
    behaviours: ['press'],
    run: async () => {},
    ...over,
  };
}

describe('ControlActionRegistry', () => {
  let registry: ControlActionRegistry;

  beforeEach(() => {
    registry = new ControlActionRegistry();
  });

  it('starts empty', () => {
    expect(registry.snapshot()).toEqual([]);
    expect(registry.get('perform.nextScene')).toBeNull();
  });

  it('returns a registered action by id', () => {
    const next = action('perform.nextScene');
    registry.register(next);
    expect(registry.get('perform.nextScene')).toBe(next);
  });

  it('keeps registration order', () => {
    registry.register(action('a'));
    registry.register(action('b'));
    registry.register(action('c'));
    expect(registry.snapshot().map(a => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('replaces rather than duplicates when the same id registers again', () => {
    registry.register(action('a', {label: 'first'}));
    registry.register(action('a', {label: 'second'}));

    expect(registry.snapshot()).toHaveLength(1);
    expect(registry.get('a')!.label).toBe('second');
  });

  it('keeps a replaced action in its original position', () => {
    registry.register(action('a'));
    registry.register(action('b'));
    registry.register(action('a', {label: 'again'}));

    expect(registry.snapshot().map(x => x.id)).toEqual(['a', 'b']);
  });

  it('unregisters through the returned function', () => {
    const off = registry.register(action('a'));
    off();
    expect(registry.snapshot()).toEqual([]);
    expect(registry.get('a')).toBeNull();
  });

  it('does not let a stale unregister remove a newer registration', () => {
    const off = registry.register(action('a', {label: 'first'}));
    registry.register(action('a', {label: 'second'}));
    off();

    expect(registry.get('a')!.label).toBe('second');
  });

  it('hands out the same snapshot array until something changes', () => {
    registry.register(action('a'));
    const first = registry.snapshot();
    expect(registry.snapshot()).toBe(first);

    registry.register(action('b'));
    expect(registry.snapshot()).not.toBe(first);
  });

  it('notifies subscribers on register and unregister', () => {
    const seen = jest.fn();
    registry.subscribe(seen);

    const off = registry.register(action('a'));
    expect(seen).toHaveBeenCalledTimes(1);
    off();
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('stops notifying an unsubscribed listener', () => {
    const seen = jest.fn();
    const unsub = registry.subscribe(seen);
    unsub();
    registry.register(action('a'));
    expect(seen).not.toHaveBeenCalled();
  });

  it('clears everything', () => {
    registry.register(action('a'));
    registry.clear();
    expect(registry.snapshot()).toEqual([]);
  });
});

describe('the app-wide registry', () => {
  afterEach(() => {
    resetControlActionRegistry();
  });

  it('is the same object for every caller', () => {
    expect(getControlActionRegistry()).toBe(getControlActionRegistry());
  });

  it('is replaced by a reset', () => {
    const before = getControlActionRegistry();
    before.register(action('a'));
    resetControlActionRegistry();
    expect(getControlActionRegistry().snapshot()).toEqual([]);
  });
});
