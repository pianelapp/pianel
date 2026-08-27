import {
  detectEdge,
  EdgeGate,
  MAX_TRACKED_CONTROLS,
} from '../../../src/services/control/EdgeGate';
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

  it('treats every sysex as a press, since it carries no release', () => {
    const sysex: ControlMessage = {
      type: 'sysex',
      data: [0xf0, 0x41, 0xf7],
      value: 127,
    };
    expect(detectEdge(null, sysex)).toBe('press');
    expect(detectEdge(127, sysex)).toBe('press');
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

  it('debounces repeats of the same sysex payload but not a different one', () => {
    const one: ControlMessage = {type: 'sysex', data: [0xf0, 0x01, 0xf7], value: 127};
    const two: ControlMessage = {type: 'sysex', data: [0xf0, 0x02, 0xf7], value: 127};

    expect(gate.admit(one)).toBe('press');
    clock = 50;
    expect(gate.admit(one)).toBeNull();
    expect(gate.admit(two)).toBe('press');
    clock = 400;
    expect(gate.admit(one)).toBe('press');
  });

  it('does not leave an orphan release when a press was debounced away', () => {
    const out: Array<string | null> = [];
    for (const [at, value] of [
      [0, 127],
      [3, 0],
      [6, 127],
      [3000, 0],
    ]) {
      clock = at;
      out.push(gate.admit(cc(value)));
    }

    expect(out).toEqual(['press', 'release', null, null]);
  });

  it('still admits a genuine press long after one was debounced away', () => {
    clock = 0;
    expect(gate.admit(cc(127))).toBe('press');
    clock = 3;
    expect(gate.admit(cc(0))).toBe('release');
    clock = 6;
    expect(gate.admit(cc(127))).toBeNull();
    clock = 5000;
    expect(gate.admit(cc(127))).toBe('press');
    clock = 5100;
    expect(gate.admit(cc(0))).toBe('release');
  });

  it('stops tracking the oldest control once the cap is passed', () => {
    for (let id = 0; id < MAX_TRACKED_CONTROLS + 10; id++) {
      clock = id;
      expect(gate.admit(cc(127, id))).toBe('press');
    }
    clock = 100000;
    expect(gate.admit(cc(0, 0))).toBeNull();
  });

  it('forgets everything on reset', () => {
    expect(gate.admit(cc(127))).toBe('press');
    gate.reset();
    expect(gate.admit(cc(127))).toBe('press');
  });
});
