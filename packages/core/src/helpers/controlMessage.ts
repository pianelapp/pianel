import type {
  Behaviour,
  ControlMatch,
  ControlMessage,
} from '../types/control';

const DATA_MASK = 0x7f;
const SYSEX_START = 0xf0;
const SYSEX_END = 0xf7;
const MIN_SYSEX_LENGTH = 3;

const EDGED_BEHAVIOURS: readonly Behaviour[] = ['press', 'release', 'peek'];
const PRESS_ONLY_BEHAVIOURS: readonly Behaviour[] = ['press'];

function isDataByte(byte: number): boolean {
  return Number.isInteger(byte) && byte >= 0x00 && byte <= DATA_MASK;
}

export function parseControlMessage(
  bytes: readonly number[],
): ControlMessage | null {
  if (bytes.length < 2) return null;

  const status = bytes[0];

  if (status === SYSEX_START) {
    const end = bytes.indexOf(SYSEX_END);
    if (end === -1) return null;
    if (end + 1 < MIN_SYSEX_LENGTH) return null;
    for (let i = 1; i < end; i++) {
      if (!isDataByte(bytes[i])) return null;
    }
    return {type: 'sysex', data: bytes.slice(0, end + 1), value: DATA_MASK};
  }

  if (status < 0x80 || status > 0xef) return null;

  const channel = (status & 0x0f) + 1;
  const kind = status & 0xf0;

  if (kind === 0xb0) {
    if (bytes.length < 3) return null;
    return {
      type: 'cc',
      channel,
      id: bytes[1] & DATA_MASK,
      value: bytes[2] & DATA_MASK,
    };
  }

  if (kind === 0x90) {
    if (bytes.length < 3) return null;
    return {
      type: 'note',
      channel,
      id: bytes[1] & DATA_MASK,
      value: bytes[2] & DATA_MASK,
    };
  }

  if (kind === 0x80) {
    if (bytes.length < 3) return null;
    return {type: 'note', channel, id: bytes[1] & DATA_MASK, value: 0};
  }

  if (kind === 0xc0) {
    return {type: 'pc', channel, id: bytes[1] & DATA_MASK, value: DATA_MASK};
  }

  return null;
}

export function messageKey(target: ControlMatch | ControlMessage): string {
  if (target.type === 'sysex') return `sysex:${target.data.join(',')}`;
  return `${target.type}:${target.channel}:${target.id}`;
}

export function toMatch(message: ControlMessage): ControlMatch {
  if (message.type === 'sysex') return {type: 'sysex', data: [...message.data]};
  return {type: message.type, channel: message.channel, id: message.id};
}

export function sameMatch(a: ControlMatch, b: ControlMatch): boolean {
  return messageKey(a) === messageKey(b);
}

export function matchesMessage(
  match: ControlMatch,
  message: ControlMessage,
): boolean {
  return messageKey(match) === messageKey(message);
}

export function canRelease(target: ControlMatch | ControlMessage): boolean {
  return target.type !== 'pc' && target.type !== 'sysex';
}

export function behavioursFor(
  target: ControlMatch | ControlMessage,
): readonly Behaviour[] {
  return canRelease(target) ? EDGED_BEHAVIOURS : PRESS_ONLY_BEHAVIOURS;
}
