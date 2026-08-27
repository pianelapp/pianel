import {
  parseControlMessage,
  messageKey,
  matchesMessage,
  sameMatch,
  toMatch,
  canRelease,
  behavioursFor,
} from '../../src/helpers/controlMessage';
import type {ControlMessage} from '../../src/types/control';

describe('parseControlMessage', () => {
  it.each([
    ['cc on channel 1', [0xb0, 0x14, 0x7f], {type: 'cc', channel: 1, id: 20, value: 127}],
    ['cc on channel 16', [0xbf, 0x14, 0x00], {type: 'cc', channel: 16, id: 20, value: 0}],
    ['note on', [0x90, 0x3c, 0x64], {type: 'note', channel: 1, id: 60, value: 100}],
    ['note on channel 10', [0x99, 0x3c, 0x01], {type: 'note', channel: 10, id: 60, value: 1}],
    ['note off', [0x80, 0x3c, 0x40], {type: 'note', channel: 1, id: 60, value: 0}],
    ['note on velocity 0', [0x90, 0x3c, 0x00], {type: 'note', channel: 1, id: 60, value: 0}],
    ['program change', [0xc0, 0x05], {type: 'pc', channel: 1, id: 5, value: 127}],
    [
      'sysex',
      [0xf0, 0x41, 0x10, 0x42, 0xf7],
      {type: 'sysex', data: [0xf0, 0x41, 0x10, 0x42, 0xf7], value: 127},
    ],
    [
      'a one-data-byte sysex',
      [0xf0, 0x7d, 0xf7],
      {type: 'sysex', data: [0xf0, 0x7d, 0xf7], value: 127},
    ],
  ])('parses %s', (_label, bytes, expected) => {
    expect(parseControlMessage(bytes as number[])).toEqual(expected);
  });

  it.each([
    ['clock', [0xf8]],
    ['active sensing', [0xfe]],
    ['start', [0xfa]],
    ['stop', [0xfc]],
    ['reset', [0xff]],
    ['song position', [0xf2, 0x00, 0x00]],
    ['an unterminated sysex', [0xf0, 0x41, 0x10]],
    ['an empty sysex', [0xf0, 0xf7]],
    ['a sysex carrying a byte above 0x7f', [0xf0, 0x94, 0xff, 0xf7]],
    ['a sysex aborted by an embedded status byte', [0xf0, 0x90, 0x40, 0xf7]],
    ['a sysex containing a nested start', [0xf0, 0xf0, 0x41, 0xf7]],
    ['a sysex carrying a non-integer', [0xf0, 1.5, 0xf7]],
    ['a sysex carrying NaN', [0xf0, NaN, 0xf7]],
    ['a sysex carrying a negative byte', [0xf0, -1, 0xf7]],
    ['polyphonic aftertouch', [0xa0, 0x3c, 0x40]],
    ['channel pressure', [0xd0, 0x40]],
    ['pitch bend', [0xe0, 0x00, 0x40]],
    ['a running-status data byte', [0x14, 0x7f]],
    ['nothing', []],
    ['a truncated cc', [0xb0, 0x14]],
    ['a truncated program change', [0xc0]],
  ])('rejects %s', (_label, bytes) => {
    expect(parseControlMessage(bytes as number[])).toBeNull();
  });

  it('stops a sysex at its terminator and ignores trailing bytes', () => {
    expect(parseControlMessage([0xf0, 0x41, 0xf7, 0x99, 0x99])).toEqual({
      type: 'sysex',
      data: [0xf0, 0x41, 0xf7],
      value: 127,
    });
  });

  it('masks data bytes to 7 bits rather than trusting the device', () => {
    expect(parseControlMessage([0xb0, 0x94, 0xff])).toEqual({
      type: 'cc',
      channel: 1,
      id: 20,
      value: 127,
    });
  });
});

describe('messageKey', () => {
  it('is stable for the same switch', () => {
    expect(messageKey({type: 'cc', channel: 1, id: 20})).toBe(
      messageKey({type: 'cc', channel: 1, id: 20}),
    );
  });

  it('separates type, channel and id', () => {
    const a = messageKey({type: 'cc', channel: 1, id: 20});
    expect(a).not.toBe(messageKey({type: 'note', channel: 1, id: 20}));
    expect(a).not.toBe(messageKey({type: 'cc', channel: 2, id: 20}));
    expect(a).not.toBe(messageKey({type: 'cc', channel: 1, id: 21}));
  });

  it('keys a sysex by its whole payload', () => {
    const a = messageKey({type: 'sysex', data: [0xf0, 0x41, 0x01, 0xf7]});
    expect(a).toBe(messageKey({type: 'sysex', data: [0xf0, 0x41, 0x01, 0xf7]}));
    expect(a).not.toBe(messageKey({type: 'sysex', data: [0xf0, 0x41, 0x02, 0xf7]}));
    expect(a).not.toBe(messageKey({type: 'sysex', data: [0xf0, 0x41, 0xf7]}));
  });

  it('cannot collide a sysex payload with a channel message', () => {
    expect(messageKey({type: 'sysex', data: [1, 2, 3]})).not.toBe(
      messageKey({type: 'cc', channel: 1, id: 20}),
    );
  });

  it('separates payloads that differ only in where the byte boundaries fall', () => {
    expect(messageKey({type: 'sysex', data: [1, 23]})).not.toBe(
      messageKey({type: 'sysex', data: [12, 3]}),
    );
  });

  it('separates a longer payload from a prefix of itself', () => {
    expect(messageKey({type: 'sysex', data: [1, 2]})).not.toBe(
      messageKey({type: 'sysex', data: [1, 2, 0]}),
    );
  });
});

describe('canRelease', () => {
  it.each([
    ['cc', {type: 'cc', channel: 1, id: 20}, true],
    ['note', {type: 'note', channel: 1, id: 60}, true],
    ['pc', {type: 'pc', channel: 1, id: 5}, false],
    ['sysex', {type: 'sysex', data: [0xf0, 0x41, 0xf7]}, false],
  ])('reports %s', (_label, match, expected) => {
    expect(canRelease(match as never)).toBe(expected);
  });
});

describe('behavioursFor', () => {
  it('offers all three behaviours to a control with a release edge', () => {
    expect(behavioursFor({type: 'cc', channel: 1, id: 20})).toEqual([
      'press',
      'release',
      'peek',
    ]);
  });

  it.each([
    ['program change', {type: 'pc', channel: 1, id: 5}],
    ['sysex', {type: 'sysex', data: [0xf0, 0x41, 0xf7]}],
  ])('offers press only to %s, which has no release edge', (_label, match) => {
    expect(behavioursFor(match as never)).toEqual(['press']);
  });
});

describe('toMatch', () => {
  it('drops the value from a channel message', () => {
    expect(toMatch({type: 'cc', channel: 1, id: 20, value: 127})).toEqual({
      type: 'cc',
      channel: 1,
      id: 20,
    });
  });

  it('copies the sysex payload rather than aliasing it', () => {
    const data = [0xf0, 0x41, 0xf7];
    const message: ControlMessage = {type: 'sysex', data, value: 127};
    const match = toMatch(message);

    expect(match).toEqual({type: 'sysex', data: [0xf0, 0x41, 0xf7]});
    data[1] = 0x42;
    expect(match).toEqual({type: 'sysex', data: [0xf0, 0x41, 0xf7]});
  });
});

describe('sameMatch', () => {
  it('compares channel messages by identity, not reference', () => {
    expect(
      sameMatch({type: 'cc', channel: 1, id: 20}, {type: 'cc', channel: 1, id: 20}),
    ).toBe(true);
    expect(
      sameMatch({type: 'cc', channel: 1, id: 20}, {type: 'cc', channel: 1, id: 21}),
    ).toBe(false);
  });

  it('compares sysex payloads element by element', () => {
    expect(
      sameMatch(
        {type: 'sysex', data: [0xf0, 0x41, 0xf7]},
        {type: 'sysex', data: [0xf0, 0x41, 0xf7]},
      ),
    ).toBe(true);
    expect(
      sameMatch(
        {type: 'sysex', data: [0xf0, 0x41, 0xf7]},
        {type: 'sysex', data: [0xf0, 0x42, 0xf7]},
      ),
    ).toBe(false);
  });
});

describe('matchesMessage', () => {
  const message: ControlMessage = {type: 'cc', channel: 1, id: 20, value: 0};

  it('ignores value', () => {
    expect(matchesMessage({type: 'cc', channel: 1, id: 20}, message)).toBe(true);
    expect(
      matchesMessage({type: 'cc', channel: 1, id: 20}, {...message, value: 127}),
    ).toBe(true);
  });

  it('rejects a different switch', () => {
    expect(matchesMessage({type: 'cc', channel: 2, id: 20}, message)).toBe(false);
    expect(matchesMessage({type: 'note', channel: 1, id: 20}, message)).toBe(false);
  });

  it('matches a sysex binding against its payload', () => {
    const sysex: ControlMessage = {
      type: 'sysex',
      data: [0xf0, 0x41, 0x01, 0xf7],
      value: 127,
    };
    expect(matchesMessage({type: 'sysex', data: [0xf0, 0x41, 0x01, 0xf7]}, sysex)).toBe(true);
    expect(matchesMessage({type: 'sysex', data: [0xf0, 0x41, 0x02, 0xf7]}, sysex)).toBe(false);
    expect(matchesMessage({type: 'cc', channel: 1, id: 20}, sysex)).toBe(false);
  });
});
