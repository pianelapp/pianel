import type {ControlMatch, ControlMessage} from '../types/control';

const DATA_MASK = 0x7f;

export function parseControlMessage(
  bytes: readonly number[],
): ControlMessage | null {
  if (bytes.length < 2) return null;

  const status = bytes[0];
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

export function messageKey(match: ControlMatch): string {
  return `${match.type}:${match.channel}:${match.id}`;
}

export function matchesMessage(
  match: ControlMatch,
  message: ControlMessage,
): boolean {
  return (
    match.type === message.type &&
    match.channel === message.channel &&
    match.id === message.id
  );
}
