/**
 * `resolveActiveToneSlot` — the left tone slot only exists in Split/Dual.
 *
 * The stored `appSettingsStore.activeToneSlot` is a persisted UI selection;
 * whether it is addressable is a function of the live voicing mode. Deriving
 * the effective slot here keeps the invariant true no matter which path
 * changed the mode (UI commit, quick-tone slot, scene/preset recall, or an
 * inbound hardware notification).
 */
import {
  hasLeftToneSlot,
  resolveActiveToneSlot,
} from '../../src/helpers/voicingMode';

describe('hasLeftToneSlot', () => {
  it('reports no left slot for Single and Twin', () => {
    expect(hasLeftToneSlot('single')).toBe(false);
    expect(hasLeftToneSlot('twin')).toBe(false);
  });

  it('reports a left slot for Split and Dual', () => {
    expect(hasLeftToneSlot('split')).toBe(true);
    expect(hasLeftToneSlot('dual')).toBe(true);
  });
});

describe('resolveActiveToneSlot', () => {
  it('forces the right slot in Single mode', () => {
    expect(resolveActiveToneSlot('single', 'left')).toBe('right');
  });

  it('forces the right slot in Twin mode', () => {
    expect(resolveActiveToneSlot('twin', 'left')).toBe('right');
  });

  it('honours the stored slot in Split mode', () => {
    expect(resolveActiveToneSlot('split', 'left')).toBe('left');
    expect(resolveActiveToneSlot('split', 'right')).toBe('right');
  });

  it('honours the stored slot in Dual mode', () => {
    expect(resolveActiveToneSlot('dual', 'left')).toBe('left');
    expect(resolveActiveToneSlot('dual', 'right')).toBe('right');
  });
});
