import {
  describeMatch,
  behaviourLabel,
  bindingLabel,
  messageLabel,
  relativeTime,
} from '../../src/components/settings/bindingLabel';

describe('describeMatch', () => {
  it.each([
    [{type: 'cc', channel: 1, id: 20}, 'CC 20 ch1'],
    [{type: 'note', channel: 10, id: 60}, 'Note 60 ch10'],
    [{type: 'pc', channel: 16, id: 5}, 'PC 5 ch16'],
  ])('renders %j as %s', (match, expected) => {
    expect(describeMatch(match as never)).toBe(expected);
  });
});

describe('behaviourLabel', () => {
  it.each([
    ['press', 'on press'],
    ['release', 'on release'],
    ['peek', 'hold to peek'],
  ])('renders %s as %s', (behaviour, expected) => {
    expect(behaviourLabel(behaviour as never)).toBe(expected);
  });
});

describe('bindingLabel', () => {
  it('joins the switch and the behaviour', () => {
    expect(
      bindingLabel({
        id: 'b1',
        match: {type: 'cc', channel: 1, id: 20},
        actionId: 'perform.nextScene',
        behaviour: 'release',
      }),
    ).toBe('CC 20 ch1 · on release');
  });
});

describe('messageLabel', () => {
  it('includes the value so an unexpected switch is diagnosable', () => {
    expect(messageLabel({type: 'cc', channel: 1, id: 20, value: 127})).toBe(
      'CC 20 ch1 val 127',
    );
  });

  it('omits the value for a program change, which carries none', () => {
    expect(messageLabel({type: 'pc', channel: 1, id: 5, value: 127})).toBe('PC 5 ch1');
  });

  it('omits the value for a sysex, which carries none either', () => {
    expect(
      messageLabel({type: 'sysex', data: [0xf0, 0x41, 0xf7], value: 127}),
    ).toBe('SysEx F0 41 F7');
  });
});

describe('describeMatch for sysex', () => {
  it('renders a short payload in full', () => {
    expect(describeMatch({type: 'sysex', data: [0xf0, 0x41, 0x10, 0xf7]})).toBe(
      'SysEx F0 41 10 F7',
    );
  });

  it('truncates a long payload and says how long it was', () => {
    const data = [0xf0, ...Array.from({length: 20}, (_, i) => i), 0xf7];
    expect(describeMatch({type: 'sysex', data})).toBe(
      'SysEx F0 00 01 02 03… (22 bytes)',
    );
  });
});

describe('relativeTime', () => {
  it.each([
    [0, 'just now'],
    [900, 'just now'],
    [1_000, '1s ago'],
    [59_000, '59s ago'],
    [60_000, '1m ago'],
    [3_600_000, '60m ago'],
  ])('renders %ims ago as %s', (elapsed, expected) => {
    expect(relativeTime(10_000_000 - (elapsed as number), 10_000_000)).toBe(expected);
  });

  it('never reads as the future when clocks disagree', () => {
    expect(relativeTime(10_001_000, 10_000_000)).toBe('just now');
  });
});
