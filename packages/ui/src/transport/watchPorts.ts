import {getMIDIAccess} from './midiAccess';

export type PortPresence = 'appeared' | 'disappeared';

export interface PortEvent {
  port: MIDIPort;
  presence: PortPresence;
}

export type PortListener = (event: PortEvent) => void;

const listeners = new Set<PortListener>();
const lastState = new Map<string, string>();

let access: MIDIAccess | null = null;
let handler: ((event: Event) => void) | null = null;

function seed(target: MIDIAccess): void {
  lastState.clear();
  target.inputs.forEach(port => lastState.set(port.id, port.state));
  target.outputs.forEach(port => lastState.set(port.id, port.state));
}

function onStateChange(event: Event): void {
  const port = (event as MIDIConnectionEvent).port;
  if (!port) return;

  const previous = lastState.get(port.id) ?? null;
  if (previous === port.state) return;
  lastState.set(port.id, port.state);

  const presence: PortPresence =
    port.state === 'connected' ? 'appeared' : 'disappeared';
  for (const listener of [...listeners]) listener({port, presence});
}

export async function watchPorts(listener: PortListener): Promise<() => void> {
  if (!access) {
    const resolved = await getMIDIAccess();
    if (!access) {
      access = resolved;
      seed(access);
      handler = onStateChange;
      access.addEventListener('statechange', handler);
    }
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && access && handler) {
      access.removeEventListener('statechange', handler);
      access = null;
      handler = null;
      lastState.clear();
    }
  };
}

export function resetPortWatch(): void {
  if (access && handler) access.removeEventListener('statechange', handler);
  listeners.clear();
  lastState.clear();
  access = null;
  handler = null;
}
