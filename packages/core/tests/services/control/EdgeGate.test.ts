import {detectEdge, EdgeGate} from '../../../src/services/control/EdgeGate';
import type {ControlMessage} from '../../../src/types/control';

function cc(value: number, id = 20): ControlMessage {
  return {type: 'cc', channel: 1, id, value};
}

describe('detectEdge', () => {
  it.each([
    ['no prior value, high', null, 127, 'press'],
    ['no prior value, low', null, 0, null],
    ['low to high', 0, 127, 'press'],
    ['high to low', 127, 0, 'release'],
    ['high to high', 127, 127, null],
    ['low to low', 0, 0, null],
    ['just under to just on the threshold', 63, 64, 'press'],
    ['on the threshold to just under', 64, 63, 'release'],
  ])('%s', (_label, previous, value, expected) => {
    expect(detectEdge(previous as number | null, cc(value as number))).toBe(expected);
  });

  it('treats every program change as a press', () => {
    const pc: ControlMessage = {type: 'pc', channel: 1, id: 5, value: 127};
    expect(detectEdge(null, pc)).toBe('press');
    expect(detectEdge(127, pc)).toBe('press');
  });

  it('treats note-on velocity 0 as a release', () => {
    const on: ControlMessage = {type: 'note', channel: 1, id: 60, value: 100};
    const off: ControlMessage = {type: 'note', channel: 1, id: 60, value: 0};
    expect(detectEdge(null, on)).toBe('press');
    expect(detectEdge(100, off)).toBe('release');
  });
});

describe('EdgeGate', () => {
  let clock: number;
  let gate: EdgeGate;

  beforeEach(() => {
    clock = 0;
    gate = new EdgeGate({debounceMs: 150, now: () => clock});
  });

  it('lets a press and its release through 50ms apart', () => {
    expect(gate.admit(cc(127))).toBe('press');
    clock = 50;
    expect(gate.admit(cc(0))).toBe('release');
  });

  it('suppresses a repeat of the same edge inside the window', () => {
    expect(gate.admit(cc(127))).toBe('press');
    clock = 50;
    expect(gate.admit(cc(0))).toBe('release');
    clock = 100;
    expect(gate.admit(cc(127))).toBeNull();
  });

  it('lets the same edge through once the window has passed', () => {
    expect(gate.admit(cc(127))).toBe('press');
    clock = 200;
    expect(gate.admit(cc(0))).toBe('release');
    clock = 400;
    expect(gate.admit(cc(127))).toBe('press');
  });

  it('debounces each switch independently', () => {
    expect(gate.admit(cc(127, 20))).toBe('press');
    clock = 10;
    expect(gate.admit(cc(127, 21))).toBe('press');
  });

  it('never reports an edge for a message that is not one', () => {
    expect(gate.admit(cc(127))).toBe('press');
    clock = 1000;
    expect(gate.admit(cc(127))).toBeNull();
  });

  it('forgets everything on reset', () => {
    expect(gate.admit(cc(127))).toBe('press');
    gate.reset();
    expect(gate.admit(cc(127))).toBe('press');
  });
});
