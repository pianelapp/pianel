import {
  parseControlMessage,
  messageKey,
  matchesMessage,
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
    ['sysex', [0xf0, 0x41, 0x10, 0xf7]],
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
});
