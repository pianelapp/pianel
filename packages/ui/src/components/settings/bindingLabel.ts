import type {
  Behaviour,
  ControlBinding,
  ControlMatch,
  ControlMessage,
} from '../../store';

const TYPE_LABEL: Record<'cc' | 'note' | 'pc', string> = {
  cc: 'CC',
  note: 'Note',
  pc: 'PC',
};

function sysexLabel(data: readonly number[]): string {
  const hex = data.map(b => b.toString(16).padStart(2, '0').toUpperCase());
  if (hex.length <= 6) return `SysEx ${hex.join(' ')}`;
  return `SysEx ${hex.slice(0, 5).join(' ')}… (${data.length} bytes)`;
}

const BEHAVIOUR_LABEL: Record<Behaviour, string> = {
  press: 'On Press',
  release: 'On Release',
  peek: 'Peek',
};

export function describeMatch(match: ControlMatch): string {
  if (match.type === 'sysex') return sysexLabel(match.data);
  return `${TYPE_LABEL[match.type]} ${match.id} CH ${match.channel}`;
}

export function behaviourLabel(behaviour: Behaviour): string {
  return BEHAVIOUR_LABEL[behaviour];
}

export function bindingLabel(binding: ControlBinding): string {
  return `${describeMatch(binding.match)} · ${behaviourLabel(binding.behaviour)}`;
}

export function messageLabel(message: ControlMessage): string {
  const base = describeMatch(message);
  if (message.type === 'pc' || message.type === 'sysex') return base;
  return `${base} val ${message.value}`;
}

export function relativeTime(at: number, now: number): string {
  const elapsed = Math.max(0, now - at);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'a few seconds ago';
  return `${minutes}m ago`;
}
